// --- State Variables ---
let currentSphere = 0.00;
let currentCylinder = -2.00;
let currentAxis = 180; // Stores the 0-180 optometric axis
let jccHandleAngle = 90; // JCC handle set to start at 90 axis
let jccFlipped = false; // False for Position 1, True for Position 2 (swaps effective red/green axes)
let tutorStep = 0;      // Controls the progression of tutorial instructions

// --- DOM Elements ---
const trialLens = document.getElementById('trialLens');
const lensAxisDisplay = document.getElementById('lensAngleDisplay');
const cylinderPowerDisplay = document.getElementById('cylinderPowerDisplay');

const jccElement = document.getElementById('jcc');
const jccRedLine = jccElement.querySelector('.jcc-red-line');
const jccGreenLine = jccElement.querySelector('.jcc-green-line');
const jccAngleDisplay = document.getElementById('jccAngleDisplay');
const flipJCCButton = document.getElementById('flipJCC');
const jccPositionDisplay = document.getElementById('jccPositionDisplay');

const increasePowerButton = document.getElementById('increasePower');
const decreasePowerButton = document.getElementById('decreasePower');
const confirmAxisButton = document.getElementById('confirmAxis');
const confirmPowerButton = document.getElementById('confirmPower');

const tutorInstructionsBox = document.getElementById('tutorInstructions');
const patientFeedbackBox = document.getElementById('patientFeedback'); // For continuous feedback
const currentRXDisplay = document.getElementById('currentRX');
const finalRXDisplay = document.getElementById('finalRX');

// Notification Box Elements
const jccNotificationBox = document.getElementById('jccNotification');
const notificationMessage = document.getElementById('notificationMessage');
const notificationOkButton = document.getElementById('notificationOkButton');

// Welcome message element
const welcomeMessageDiv = document.getElementById('welcomeMessage');

// Start Tutorial Button
const startTutorialButton = document.getElementById('startTutorialButton');

// SVG Axis Slider Elements
const jccAxisSliderDiv = document.getElementById('jccAxisSlider'); // Parent div
const jccAxisSliderSVG = jccAxisSliderDiv.querySelector('svg');
const jccSliderThumb = jccAxisSliderDiv.querySelector('.slider-thumb');
const jccAxisLine = document.getElementById('jccAxisLine'); 

const lensAxisSliderDiv = document.getElementById('lensAxisSlider'); // Parent div
const lensAxisSliderSVG = lensAxisSliderDiv.querySelector('svg');
const lensSliderThumb = lensAxisSliderDiv.querySelector('.slider-thumb');
const lensAxisLine = document.getElementById('lensAxisLine'); 

let isDraggingJCC = false;
let isDraggingLens = false;

// SVG Path properties (from viewBox="0 0 100 100")
const SVG_VIEWBOX_WIDTH = 100;
const SVG_VIEWBOX_HEIGHT = 100;
const SVG_CENTER_X = 50; 
const SVG_CENTER_Y = 50; 
const SVG_RADIUS = 40; 

// --- Helper Functions ---

/**
 * Rounds an angle to the nearest 5-degree increment.
 * @param {number} angle
 * @returns {number} Rounded angle.
 */
function roundTo5Degrees(angle) {
    return Math.round(angle / 5) * 5;
}

/**
 * Gets the display axis value (ensuring 0 is always displayed as 180 for optometric consistency).
 * This also ensures the final output is 0-180 and snapped to 5 degrees.
 * @param {number} angle A raw angle (could be outside 0-180, e.g., from calculations).
 * @returns {number} Display angle (0-180, where 0 becomes 180).
 */
function getDisplayAxis(angle) {
    let displayAngle = roundTo5Degrees(angle);
    displayAngle = displayAngle % 180; 
    if (displayAngle < 0) { 
        displayAngle += 180;
    }
    if (displayAngle === 0) {
        return 180;
    }
    return displayAngle;
}


/**
 * Sets the position of an SVG thumb on the full circular track based on a visual angle (0-360 CW from right).
 * Also updates the corresponding axis line.
 * @param {SVGElement} thumb The SVG circle element for the thumb.
 * @param {number} visualAngle360 The angle in degrees (0-360 CW from right) for visual placement of the thumb.
 */
function setSvgThumbPosition(thumb, visualAngle360) {
    // Convert angle from degrees (0-360 CW from right) to radians
    const angleRad = (visualAngle360 * Math.PI) / 180;

    // Calculate SVG coordinates (SVG y-axis is positive downwards)
    const x = SVG_CENTER_X + SVG_RADIUS * Math.cos(angleRad);
    const y = SVG_CENTER_Y + SVG_RADIUS * Math.sin(angleRad);

    thumb.setAttribute('cx', x);
    thumb.setAttribute('cy', y);

    let axisLine;
    if (thumb === jccSliderThumb) {
        axisLine = jccAxisLine;
    } else if (thumb === lensSliderThumb) {
        axisLine = lensAxisLine;
    }

    if (axisLine) {
        axisLine.setAttribute('x1', SVG_CENTER_X);
        axisLine.setAttribute('y1', SVG_CENTER_Y);
        axisLine.setAttribute('x2', x);
        axisLine.setAttribute('y2', y);
    }
}


/**
 * Updates the visual display of the trial lens, current RX text, and cylinder power on axis.
 */
function updateLensDisplay() {
    // MODIFIED: Apply negative rotation for CCW optometric axis display
    trialLens.style.transform = `rotate(${-currentAxis}deg)`; 
    lensAxisDisplay.textContent = `${getDisplayAxis(currentAxis)}°`;
    currentRXDisplay.textContent = `${currentSphere.toFixed(2)} DS / ${currentCylinder.toFixed(2)} DC x ${getDisplayAxis(currentAxis)}°`;

    cylinderPowerDisplay.textContent = `${currentCylinder.toFixed(2)} DC`;
    
    const offsetFromCenter = 50; 
    const lensDiameter = trialLens.offsetWidth; 
    const lensRadius = lensDiameter / 2;

    // When drawing the text, we still use the actual optometric angle for positioning
    const angleRad = (currentAxis * Math.PI) / 180; 
    const xPos = lensRadius + offsetFromCenter * Math.cos(angleRad);
    const yPos = lensRadius + offsetFromCenter * Math.sin(angleRad);

    cylinderPowerDisplay.style.left = `${xPos}px`;
    cylinderPowerDisplay.style.top = `${yPos}px`;

    // Counter-rotate text to keep it readable, using the *visual* rotation angle
    cylinderPowerDisplay.style.transform = `translate(-50%, -50%) rotate(${currentAxis}deg)`; // Use positive currentAxis to counter-rotate the -currentAxis
    
    // The thumb's visual position still tracks the 0-360 CW mouse movement
    // To match the optometric axis (CCW), we need to convert the currentAxis.
    // Optometric axis 0-180 CCW is equivalent to (360 - optometricAxis) or (180 - optometricAxis + 180) CW.
    // A simpler way for the visual slider: if currentAxis is X (CCW from right, 90 up),
    // then for the visual 360 CW slider, it's either X (0-180 down) or (360-X) (0-180 up)
    let visualSliderAngle = currentAxis;
    if (currentAxis > 0 && currentAxis < 180) { // If axis is in the top half (CCW 0-180), for a CW visual slider, it's 360-axis
        visualSliderAngle = (360 - currentAxis) % 360;
    }
    // Else if axis is 0 or 180, visual is 0 or 180.
    // Else if axis is 90, visual is 270 (if we map 90-up to 270).
    // Let's revert to a simpler method for thumb position - direct map, as the optometric mapping function handles the interpretation.
    // The slider thumb visually tracks the RAW mouse position, not the mapped optometric value directly.
    // So, it's best to let `setSvgThumbPosition` use the raw 360-deg input from `moveHandler`
    // and just set an initial position based on `currentAxis` converted to 360 CW for visual init.
    // For initialization, if `currentAxis` is 45 (CCW up-right), the visual should be 315 (CW up-right).
    // If `currentAxis` is 90 (CCW up), visual should be 270 (CW up).
    // If `currentAxis` is 135 (CCW up-left), visual should be 225 (CW up-left).
    // The previous mapping in `setSvgThumbPosition` was simpler for display, let's keep it.
    setSvgThumbPosition(lensSliderThumb, currentAxis); 
}

/**
 * Updates the visual display of the JCC (handle, red/green lines, and position text).
 */
function updateJCCDisplay() {
    // MODIFIED: Apply negative rotation for CCW optometric axis display
    jccElement.style.transform = `rotate(${-jccHandleAngle}deg)`;

    let redLineRelativeOffset, greenLineRelativeOffset;

    if (!jccFlipped) { // Position 1 (minus cylinder axis is 45 deg CCW from handle)
        redLineRelativeOffset = -45; 
        greenLineRelativeOffset = +45; 
        jccPositionDisplay.textContent = "Position 1";
    } else { // Position 2 (minus cylinder axis is 45 deg CW from handle)
        redLineRelativeOffset = +45; 
        greenLineRelativeOffset = -45; 
        jccPositionDisplay.textContent = "Position 2";
    }

    // These lines are relative to the jccElement, so their rotation needs to be in the
    // same direction as the jccElement's rotation to be visually correct.
    // Since jccElement rotates by -jccHandleAngle, their relative rotations should remain consistent.
    jccRedLine.style.transform = `translateX(-50%) rotate(${redLineRelativeOffset}deg)`;
    jccGreenLine.style.transform = `translateX(-50%) rotate(${greenLineRelativeOffset}deg)`;
    
    // Counter-rotate text for readability, using the *visual* rotation angle
    jccPositionDisplay.style.transform = `translate(-50%, -50%) translateY(-55px) rotate(${jccHandleAngle}deg)`;

    jccAngleDisplay.textContent = `${getDisplayAxis(jccHandleAngle)}°`;

    // See comments in updateLensDisplay for setSvgThumbPosition
    setSvgThumbPosition(jccSliderThumb, jccHandleAngle); 
}

/**
 * Displays an instruction message from the tutor.
 * @param {string} text The instruction text.
 */
function displayInstruction(text) {
    tutorInstructionsBox.innerHTML = `<strong>Tutor:</strong> ${text}`;
}

/**
 * Displays patient feedback in the *continuous* feedback box (bottom panel).
 * @param {string} text The patient's feedback.
 */
function displayContinuousPatientFeedback(text) {
    patientFeedbackBox.innerHTML = `<strong>Patient:</strong> ${text}`;
}

/**
 * Displays a central red notification with patient feedback/instruction.
 * @param {string} message The message to display.
 * @param {function} onOkCallback Function to call when OK is pressed.
 */
function showJCCNotification(message, onOkCallback) {
    notificationMessage.textContent = message;
    jccNotificationBox.classList.remove('hidden');
    disableAllControls(); // Disable other controls while notification is active
    notificationOkButton.disabled = false;
    notificationOkButton.onclick = () => {
        jccNotificationBox.classList.add('hidden');
        notificationOkButton.onclick = null; // Clear callback
        onOkCallback(); // Execute the callback to advance tutor
    };
}


/**
 * Disables all interactive controls in the simulator.
 */
function disableAllControls() {
    flipJCCButton.disabled = true;
    jccAxisSliderDiv.classList.add('disabled'); // Disable JCC SVG slider
    lensAxisSliderDiv.classList.add('disabled'); // Disable Lens SVG slider
    increasePowerButton.disabled = true;
    decreasePowerButton.disabled = true;
    confirmAxisButton.disabled = true;
    confirmPowerButton.disabled = true;
    notificationOkButton.disabled = true;
    startTutorialButton.disabled = true; // Disable start button by default
}

/**
 * Enables specific controls.
 * @param {string[]} controls An array of control IDs or types to enable.
 */
function enableControls(controls) {
    controls.forEach(control => {
        switch(control) {
            case 'flipJCC': flipJCCButton.disabled = false; break;
            case 'jccRotation': jccAxisSliderDiv.classList.remove('disabled'); break; // Enable JCC SVG slider
            case 'lensRotation': lensAxisSliderDiv.classList.remove('disabled'); break; // Enable Lens SVG slider
            case 'increasePower': increasePowerButton.disabled = false; break;
            case 'decreasePower': decreasePowerButton.disabled = false; break;
            case 'confirmAxis': confirmAxisButton.disabled = false; break;
            case 'confirmPower': confirmPowerButton.disabled = false; break;
            case 'startTutorialButton': startTutorialButton.disabled = false; break; // Enable start button
        }
    });
}


/**
 * Gets the current effective red line axis of the JCC (absolute angle).
 * @returns {number} The effective minus cylinder axis (0-180).
 */
function getJCCRedLineAxis() {
    let redLineOffset;
    if (!jccFlipped) { // Position 1
        redLineOffset = -45; // CCW from handle
    } else { // Position 2
        redLineOffset = +45; // CCW from handle
    }
    let calculatedAxis = jccHandleAngle + redLineOffset;
    return getDisplayAxis(calculatedAxis); 
}

/**
 * Gets the current effective green line axis of the JCC (absolute angle).
 * @returns {number} The effective plus cylinder axis (0-180).
 */
function getJCCGreenLineAxis() {
    let greenLineOffset;
    if (!jccFlipped) { // Position 1
        greenLineOffset = +45; // CCW from handle
    } else { // Position 2
        greenLineOffset = -45; // CCW from handle
    }
    let calculatedAxis = jccHandleAngle + greenLineOffset;
    return getDisplayAxis(calculatedAxis); 
}


// --- SVG Slider Interaction Logic ---

/**
 * Converts mouse/touch coordinates to SVG coordinates.
 * @param {Event} event The mouse or touch event.
 * @param {SVGElement} svgElement The SVG element.
 * @returns {{x: number, y: number}} SVG coordinates.
 */
function getSvgCoordinates(event, svgElement) {
    const rect = svgElement.getBoundingClientRect();
    const clientX = event.touches ? event.touches[0].clientX : event.clientX;
    const clientY = event.touches ? event.touches[0].clientY : event.clientY;

    // Calculate mouse/touch position relative to the SVG viewbox (0-100 for width, 0-100 for height)
    const svgX = (clientX - rect.left) / rect.width * SVG_VIEWBOX_WIDTH;
    const svgY = (clientY - rect.top) / rect.height * SVG_VIEWBOX_HEIGHT;
    return { x: svgX, y: svgY };
}


/**
 * Converts SVG coordinates to an optometric angle (0-180).
 * This function now correctly interprets a 360-degree drag into a 0-180 optometric axis,
 * where 0 is right, 90 is up, and 180 is left (increasing counter-clockwise).
 * @param {{x: number, y: number}} svgCoords Mouse/touch coordinates in SVG space.
 * @returns {number} The calculated optometric angle (0-180).
 */
function svgCoordsToOptometricAxis(svgCoords) {
    const deltaX = svgCoords.x - SVG_CENTER_X;
    const deltaY = svgCoords.y - SVG_CENTER_Y;

    // Math.atan2(y, x) calculates angle counter-clockwise from the positive X-axis.
    // In SVG, positive Y is downwards. To get a standard mathematical CCW angle (Y positive upwards), negate deltaY.
    let angleRad = Math.atan2(-deltaY, deltaX);
    let angleDeg = angleRad * 180 / Math.PI;

    // Normalize to 0-360 degrees, increasing counter-clockwise from right horizontal.
    angleDeg = (angleDeg + 360) % 360;

    // Map the 0-360 CCW angle to optometric 0-180 axis.
    // Optometric axis folds the 360 circle into 180, where 0 and 180 are the same horizontal meridian.
    let optometricAxis = angleDeg;
    if (optometricAxis > 180) {
        optometricAxis -= 180; // Example: 225 becomes 45 (225-180), 270 becomes 90 (270-180)
    }
    return Math.round(optometricAxis); 
}

/**
 * Handles the start of dragging for an SVG axis slider.
 * @param {Event} e The mouse or touch event.
 * @param {HTMLElement} sliderDiv The parent div containing the SVG slider.
 * @param {SVGElement} sliderSvg The SVG element itself.
 * @param {SVGElement} thumbElement The draggable circle thumb.
 * @param {Function} updateValueCallback Callback function to update the corresponding state variable (currentAxis or jccHandleAngle).
 */
function startDrag(e, sliderDiv, sliderSvg, thumbElement, updateValueCallback) {
    if (sliderDiv.classList.contains('disabled')) return;

    if (sliderDiv === jccAxisSliderDiv) {
        isDraggingJCC = true;
    } else if (sliderDiv === lensAxisSliderDiv) {
        isDraggingLens = true;
    }

    const moveHandler = (moveEvent) => {
        if (!isDraggingJCC && !isDraggingLens) return;

        const svgCoords = getSvgCoordinates(moveEvent, sliderSvg);
        const newOptometricAxis = svgCoordsToOptometricAxis(svgCoords); // 0-180 for internal value

        // For smooth visual tracking of the thumb around 360 degrees:
        // This is the raw angle (0-360 CW) that the mouse position translates to on the SVG.
        // We use deltaY as positive downwards for this visual angle calculation.
        const currentDeltaX = svgCoords.x - SVG_CENTER_X;
        const currentDeltaY = svgCoords.y - SVG_CENTER_Y;
        let currentRawVisualAngle360 = (Math.atan2(currentDeltaY, currentDeltaX) * 180 / Math.PI + 360) % 360;

        // Update the internal state with the 0-180 optometric axis
        updateValueCallback(newOptometricAxis);
        
        // Visually set the thumb position on the 360-degree SVG, tracking the raw mouse movement
        setSvgThumbPosition(thumbElement, currentRawVisualAngle360);
        
        // Update the text display with the 0-180 optometric axis (snapped to 5 degrees, and 0 becomes 180)
        if (sliderDiv === jccAxisSliderDiv) {
            jccAngleDisplay.textContent = `${getDisplayAxis(newOptometricAxis)}°`;
        } else if (sliderDiv === lensAxisSliderDiv) {
            lensAngleDisplay.textContent = `${getDisplayAxis(newOptometricAxis)}°`;
        }
        
        moveEvent.preventDefault(); 
    };

    const upHandler = () => {
        isDraggingJCC = false;
        isDraggingLens = false;
        document.removeEventListener('mousemove', moveHandler);
        document.removeEventListener('mouseup', upHandler);
        document.removeEventListener('touchmove', moveHandler);
        document.removeEventListener('touchend', upHandler);

        // After release, ensure the internal value and visual display are snapped to 5 degrees
        let finalOptometricAxis;
        if (sliderDiv === jccAxisSliderDiv) {
            finalOptometricAxis = getDisplayAxis(jccHandleAngle); 
            jccHandleAngle = finalOptometricAxis;
            updateJCCDisplay(); 
        } else if (sliderDiv === lensAxisSliderDiv) {
            finalOptometricAxis = getDisplayAxis(currentAxis); 
            currentAxis = finalOptometricAxis;
            updateLensDisplay(); 
        }

        checkSliderValueForNextStep(); 
    };

    document.addEventListener('mousemove', moveHandler);
    document.addEventListener('mouseup', upHandler);
    document.addEventListener('touchmove', moveHandler, { passive: false });
    document.addEventListener('touchend', upHandler);

    // Initial call to set visual position when drag starts
    const initialSvgCoords = getSvgCoordinates(e, sliderSvg);
    const initialDeltaX = initialSvgCoords.x - SVG_CENTER_X;
    const initialDeltaY = initialSvgCoords.y - SVG_CENTER_Y;
    let initialRawVisualAngle360 = (Math.atan2(initialDeltaY, initialDeltaX) * 180 / Math.PI + 360) % 360;
    setSvgThumbPosition(thumbElement, initialRawVisualAngle360);
    
    // Also set the internal angle immediately, applying the 0->180 rule
    updateValueCallback(getDisplayAxis(svgCoordsToOptometricAxis(initialSvgCoords)));
}


// Callback functions for the SVG sliders to update state
function updateJCCRotation(angle) {
    jccHandleAngle = angle;
}

function updateLensRotation(angle) {
    currentAxis = angle;
}

/**
 * Checks if the current slider value is correct for the current tutorial step to advance.
 * Called after a slider is released.
 */
function checkSliderValueForNextStep() {
    switch (tutorStep) {
        case 1: // Initial JCC handle alignment
            if (jccHandleAngle === 180) { 
                nextStep();
            }
            break;
        case 8: // Rotate lens to 5 degrees
            if (currentAxis === 5) {
                nextStep();
            }
            break;
        case 9: // Align JCC handle to new lens axis (5 deg)
            if (jccHandleAngle === 5) {
                nextStep();
            }
            break;
        case 17: // Align JCC red line with lens axis for power
            const targetPowerRefineJCCHandleAngle = getDisplayAxis(currentAxis + 45); 
            if (jccHandleAngle === targetPowerRefineJCCHandleAngle) {
                nextStep();
            }
            break;
    }
}


// --- Main Tutor Flow Logic (nextStep function) ---

/**
 * Advances the simulation to the next tutor step based on the defined flow.
 * Enables/disables controls and provides instructions/feedback as per the step.
 */
function nextStep() {
    tutorStep++;
    disableAllControls(); 

    switch (tutorStep) {
        case 1: 
            welcomeMessageDiv.textContent = `Welcome! Retinoscopy found Plano / -2.00 DC x 180. Your current trial lens is set to this. We'll refine the axis first.`;
            displayContinuousPatientFeedback(`Ready for examination.`);
            setTimeout(() => {
                displayInstruction(`For axis refinement, align the JCC handle with the current cylinder axis. Your trial lens is at 180°. Please set the JCC Handle Angle to 180° using the circular slider.`);
                enableControls(['jccRotation']);
            }, 500); 
            break;

        case 2: 
            displayInstruction(`JCC handle is at ${getDisplayAxis(jccHandleAngle)}°. Click 'Flip JCC' to view Position 1.`);
            enableControls(['flipJCC']);
            jccFlipped = false; 
            updateJCCDisplay(); 
            break;

        case 3: 
            displayContinuousPatientFeedback(`Position 2 (red line at 40°): Blurred.`); 
            showJCCNotification(`Position 2 (red line at 40°): Blurred. Now, click 'Flip JCC' again to view Position 1.`, nextStep);
            break;

        case 4: 
            displayInstruction(`Click 'Flip JCC' again to view Position 1.`);
            enableControls(['flipJCC']);
            jccFlipped = true; 
            updateJCCDisplay();
            break;

        case 5: 
            displayContinuousPatientFeedback(`Position 1 (red line at 140°): Blurred.`); 
            showJCCNotification(`Position 1 (red line at 140°): Blurred. Now, click 'Flip JCC' one more time to view Position 2 and finalize.`, nextStep);
            break;

        case 6: 
            displayInstruction(`Click 'Flip JCC' one more time to view Position 2 and finalize.`);
            enableControls(['flipJCC']);
            jccFlipped = false; 
            updateJCCDisplay();
            break;

        case 7: 
            displayContinuousPatientFeedback(`Position 2 (red line at 40°): Clearer than Position 1.`);
            showJCCNotification(`Position 2 (red line at 40°) is clearer than Position 1. Rotate the cylinder lens towards the red line (because of minus lens) for 5 degrees (to axis 5°).`, nextStep);
            break;

        case 8: 
            displayInstruction(`As instructed, rotate the trial lens cylinder axis to 5° using the circular slider.`);
            enableControls(['lensRotation']);
            updateLensDisplay(); 
            break;

        case 9: 
            displayInstruction(`Trial lens is now at ${getDisplayAxis(currentAxis)}°. Now align the JCC handle parallel to this new lens axis (${getDisplayAxis(currentAxis)}°) for further refinement. Please set the JCC Handle Angle to ${getDisplayAxis(currentAxis)}° using the circular slider.`);
            enableControls(['jccRotation']);
            updateJCCDisplay(); 
            break;

        case 10: 
            displayInstruction(`JCC handle is at ${getDisplayAxis(jccHandleAngle)}°. Click 'Flip JCC' to show Position 1 for axis confirmation.`);
            enableControls(['flipJCC']);
            jccFlipped = false; 
            updateJCCDisplay();
            break;

        case 11: 
            displayContinuousPatientFeedback(`Position 2 (red line at ${getJCCRedLineAxis()}°): Equally blurred.`); 
            showJCCNotification(`Position 2 (red line at ${getJCCRedLineAxis()}°): Equally blurred. Now, click 'Flip JCC' again to view Position 1.`, nextStep);
            break;

        case 12: 
            displayInstruction(`Click 'Flip JCC' again to view Position 1.`);
            enableControls(['flipJCC']);
            jccFlipped = true; 
            updateJCCDisplay();
            break;

        case 13: 
            displayContinuousPatientFeedback(`Position 1 (red line at ${getJCCRedLineAxis()}°): Equally blurred.`); 
            showJCCNotification(`Position 1 (red line at ${getJCCRedLineAxis()}°): Equally blurred. Now, click 'Flip JCC' one more time to view Position 2 and finalize.`, nextStep);
            break;

        case 14: 
            displayInstruction(`Click 'Flip JCC' one more time to view Position 2 and finalize.`);
            enableControls(['flipJCC']);
            jccFlipped = false; 
            updateJCCDisplay();
            break;

        case 15: 
            displayContinuousPatientFeedback(`Position 2 (red line at ${getJCCRedLineAxis()}°): Equally blurred.`); 
            showJCCNotification(`Both positions are 'Equally blurred'. This confirms ${getDisplayAxis(currentAxis)}° as the correct cylinder axis! Now confirm the axis.`, nextStep);
            break;

        case 16: 
            displayInstruction(`As indicated by patient feedback, confirm the axis by clicking 'Confirm Axis'.`);
            enableControls(['confirmAxis']);
            break;

        case 17: 
            const powerRefineJCCHandleAngle = getDisplayAxis(currentAxis + 45); 
            displayInstruction(`Axis confirmed at ${getDisplayAxis(currentAxis)}°. Now for power refinement. Align the JCC's red line (minus cylinder axis) parallel to the current lens axis (${getDisplayAxis(currentAxis)}°). For Position 1 (unflipped JCC), this means setting the JCC Handle Angle to ${powerRefineJCCHandleAngle}°. Please set the JCC Handle Angle to ${powerRefineJCCHandleAngle}°.`);
            enableControls(['jccRotation']);
            updateJCCDisplay(); 
            break;

        case 18: 
            displayInstruction(`JCC's red line is now aligned with the lens axis at ${getJCCRedLineAxis()}°. Click 'Flip JCC' to show Position 1 for power comparison.`);
            enableControls(['flipJCC']);
            jccFlipped = false; 
            updateJCCDisplay();
            break;

        case 19: 
            displayContinuousPatientFeedback(`Position 2 (red line along ${getDisplayAxis(currentAxis)}°, green line at ${getJCCGreenLineAxis()}°): Clearer than Position 1.`);
            showJCCNotification(`Position 2 (red line along ${getDisplayAxis(currentAxis)}°, green line at ${getJCCGreenLineAxis()}°): Clearer than Position 1. Now, click 'Flip JCC' again to view Position 1.`, nextStep);
            break;

        case 20: 
            displayInstruction(`Click 'Flip JCC' again to view Position 1.`);
            enableControls(['flipJCC']);
            jccFlipped = true; 
            updateJCCDisplay();
            break;

        case 21: 
            displayContinuousPatientFeedback(`Position 1 (green line along ${getDisplayAxis(currentAxis)}°, red line at ${getJCCRedLineAxis()}°): Blurred.`);
            showJCCNotification(`Position 1 (green line along ${getDisplayAxis(currentAxis)}°, red line at ${getJCCRedLineAxis()}°): Blurred. Now, click 'Flip JCC' one more time to view Position 2 and finalize.`, nextStep);
            break;

        case 22: 
            displayInstruction(`Click 'Flip JCC' one more time to view Position 2 and finalize.`);
            enableControls(['flipJCC']);
            jccFlipped = false; 
            updateJCCDisplay();
            break;

        case 23: 
            displayContinuousPatientFeedback(`Position 2 (red line along ${getDisplayAxis(currentAxis)}°, green line at ${getJCCGreenLineAxis()}°): Clearer than Position 1.`);
            showJCCNotification(`Position 2 (red line along ${getDisplayAxis(currentAxis)}°, green line at ${getJCCGreenLineAxis()}°): Clearer than Position 1. This means more minus cylinder power is needed. Add -0.25 DC to the lens.`, nextStep);
            break;

        case 24: 
            displayInstruction(`Based on patient feedback, click 'Increase Power (-0.25 DC)'.`);
            enableControls(['increasePower', 'decreasePower']);
            break;

        case 25: 
            displayInstruction(`Cylinder power increased to ${currentCylinder.toFixed(2)} DC. Click 'Flip JCC' again to re-evaluate Position 1.`);
            enableControls(['flipJCC']);
            jccFlipped = false; 
            updateJCCDisplay();
            break;

        case 26: 
            displayContinuousPatientFeedback(`Position 2 (red line along ${getDisplayAxis(currentAxis)}°, green line at ${getJCCGreenLineAxis()}°): Still slightly clearer than Position 1.`);
            showJCCNotification(`Position 2 (red line along ${getDisplayAxis(currentAxis)}°, green line at ${getJCCGreenLineAxis()}°): Still slightly clearer than Position 1. Now, click 'Flip JCC' again to view Position 1.`, nextStep);
            break;

        case 27: 
            displayInstruction(`Click 'Flip JCC' again to view Position 1.`);
            enableControls(['flipJCC']);
            jccFlipped = true; 
            updateJCCDisplay();
            break;

        case 28: 
            displayContinuousPatientFeedback(`Position 1 (green line along ${getDisplayAxis(currentAxis)}°, red line at ${getJCCRedLineAxis()}°): Still slightly blurred.`);
            showJCCNotification(`Position 1 (green line along ${getDisplayAxis(currentAxis)}°, red line at ${getJCCRedLineAxis()}°): Still slightly blurred. Now, click 'Flip JCC' one more time to view Position 2 and finalize.`, nextStep);
            break;

        case 29: 
            displayInstruction(`Click 'Flip JCC' one more time to view Position 2 and finalize.`);
            enableControls(['flipJCC']);
            jccFlipped = false; 
            updateJCCDisplay();
            break;

        case 30: 
            displayContinuousPatientFeedback(`Position 2 (red line along ${getDisplayAxis(currentAxis)}°, green line at ${getJCCGreenLineAxis()}°): Still slightly clearer than Position 1.`);
            showJCCNotification(`Position 2 (red line along ${getDisplayAxis(currentAxis)}°, green line at ${getJCCGreenLineAxis()}°): Still slightly clearer than Position 1. Let's add another -0.25 DC.`, nextStep);
            break;

        case 31: 
            displayInstruction(`Based on patient feedback, click 'Increase Power (-0.25 DC)' again.`);
            enableControls(['increasePower', 'decreasePower']);
            break;

        case 32: 
            displayInstruction(`Cylinder power increased to ${currentCylinder.toFixed(2)} DC. Click 'Flip JCC' again to re-evaluate Position 1.`);
            enableControls(['flipJCC']);
            jccFlipped = false; 
            updateJCCDisplay();
            break;

        case 33: 
            displayContinuousPatientFeedback(`Position 2 (red line along ${getDisplayAxis(currentAxis)}°, green line at ${getJCCGreenLineAxis()}°): Equally blurred.`);
            showJCCNotification(`Position 2 (red line along ${getDisplayAxis(currentAxis)}°, green line at ${getJCCGreenLineAxis()}°): Equally blurred. Now, click 'Flip JCC' again to view Position 1.`, nextStep);
            break;
            
        case 34: 
            displayInstruction(`Click 'Flip JCC' again to view Position 1.`);
            enableControls(['flipJCC']);
            jccFlipped = true; 
            updateJCCDisplay();
            break;

        case 35: 
            displayContinuousPatientFeedback(`Position 1 (green line along ${getDisplayAxis(currentAxis)}°, red line at ${getJCCRedLineAxis()}°): Equally blurred.`);
            showJCCNotification(`Position 1 (green line along ${getDisplayAxis(currentAxis)}°, red line at ${getJCCRedLineAxis()}°): Equally blurred. Now, click 'Flip JCC' one more time to view Position 2 and finalize.`, nextStep);
            break;

        case 36: 
            displayInstruction(`Click 'Flip JCC' one more time to view Position 2 and finalize.`);
            enableControls(['flipJCC']);
            jccFlipped = false; 
            updateJCCDisplay();
            break;

        case 37: 
            displayContinuousPatientFeedback(`Position 2 (red line along ${getDisplayAxis(currentAxis)}°, green line at ${getJCCGreenLineAxis()}°): Equally blurred.`);
            showJCCNotification(`Position 2 (red line along ${getDisplayAxis(currentAxis)}°, green line at ${getJCCGreenLineAxis()}°): Equally blurred. Both positions are now equally blurred! The cylinder power of ${currentCylinder.toFixed(2)} DC at axis ${getDisplayAxis(currentAxis)}° is confirmed. Now confirm the power.`, nextStep);
            break;

        case 38: 
            displayInstruction(`As indicated by patient feedback, confirm the power by clicking 'Confirm Power'.`);
            enableControls(['confirmPower']);
            break;
            
        case 39: 
            displayInstruction(`Congratulations! You have successfully refined the cylinder axis and power. The final verified prescription is displayed below.`);
            finalRXDisplay.textContent = `${currentSphere.toFixed(2)} DS / ${currentCylinder.toFixed(2)} DC x ${getDisplayAxis(currentAxis)}°`;
            disableAllControls();
            break;

        default:
            displayInstruction("Simulation complete. Refresh the page to restart.");
            break;
    }
}

// --- Event Listeners ---

// JCC SVG Slider Events
jccAxisSliderDiv.addEventListener('mousedown', (e) => startDrag(e, jccAxisSliderDiv, jccAxisSliderSVG, jccSliderThumb, updateJCCRotation));
jccAxisSliderDiv.addEventListener('touchstart', (e) => startDrag(e, jccAxisSliderDiv, jccAxisSliderSVG, jccSliderThumb, updateJCCRotation));

// Lens SVG Slider Events
lensAxisSliderDiv.addEventListener('mousedown', (e) => startDrag(e, lensAxisSliderDiv, lensAxisSliderSVG, lensSliderThumb, updateLensRotation));
lensAxisSliderDiv.addEventListener('touchstart', (e) => startDrag(e, lensAxisSliderDiv, lensAxisSliderSVG, lensSliderThumb, updateLensRotation));


// Listen for JCC flip button clicks
flipJCCButton.addEventListener('click', () => {
    if (flipJCCButton.disabled) return; 

    jccFlipped = !jccFlipped; 
    updateJCCDisplay();

    nextStep();
});

// Listen for power increase button clicks
increasePowerButton.addEventListener('click', () => {
    currentCylinder -= 0.25; 
    updateLensDisplay();
    if (tutorStep === 24 || tutorStep === 31) { 
        nextStep();
    }
});

// Listen for power decrease button clicks (not used in this specific tutorial flow but included for completeness)
decreasePowerButton.addEventListener('click', () => {
    currentCylinder += 0.25; 
    updateLensDisplay();
});

// Listen for Confirm Axis button clicks
confirmAxisButton.addEventListener('click', () => {
    if (tutorStep === 16 && currentAxis === 5) {
        nextStep();
    }
});

// Listen for Confirm Power button clicks
confirmPowerButton.addEventListener('click', () => {
    if (tutorStep === 38 && currentCylinder === -2.50) {
        nextStep();
    }
});

// Start Tutorial Button Event Listener
startTutorialButton.addEventListener('click', () => {
    startTutorialButton.disabled = true; 
    nextStep(); 
});


// --- Initialization ---
function init() {
    currentSphere = 0.00;
    currentCylinder = -2.00;
    currentAxis = 180; 
    jccHandleAngle = 90; 

    updateLensDisplay();
    updateJCCDisplay();
    displayContinuousPatientFeedback(`Awaiting instructions.`);
    welcomeMessageDiv.textContent = `Welcome to the JCC Refinement Simulator! Retinoscopy found Plano / -2.00 DC x 180. Click 'Start Tutorial' to begin refining the cylinder axis.`;
    
    disableAllControls(); 
    enableControls(['startTutorialButton']); 
}

document.addEventListener('DOMContentLoaded', init);