const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
var recognition = new SpeechRecognition()
recognition.continuous = true
recognition.start()
recognition.onresult = function(event) {
    if (event.results.length > 0) {
        if (mouseOverSTL == true) {
            isSquareTopLeftSelected()
        }
        if (mouseOverSTM == true) {
            isSquareTopMiddleSelected()
        }
        if (mouseOverSTR == true) {
            isSquareTopRightSelected()
        }
        if (mouseOverSML == true) {
            isSquareMiddleLeftSelected()
        }
        if (mouseOverSMM == true) {
            isSquareMiddleMiddleSelected()
        }
        if (mouseOverSMR == true) {
            isSquareMiddleRightSelected()
        }
        if (mouseOverSBL == true) {
            isSquareBottomLeftSelected()
        }
        if (mouseOverSBM == true) {
            isSquareBottomMiddleSelected()
        }
        if (mouseOverSBR == true) {
            isSquareBottomRightSelected()
        }
        if (mouseOverRedButton == true) {
            chosenColor = "Red"
            updateSelectedSquares()
        }
        if (mouseOverOrangeButton == true) {
            chosenColor = "Orange"
            updateSelectedSquares()
        }
        if (mouseOverYellowButton == true) {
            chosenColor = "Yellow"
            updateSelectedSquares()
        }
        if (mouseOverGreenButton == true) {
            chosenColor = "Green"
            updateSelectedSquares()
        }
        if (mouseOverBrownButton == true) {
            chosenColor = "Brown"
            updateSelectedSquares()
        }
        if (mouseOverPinkButton == true) {
            chosenColor = "Pink"
            updateSelectedSquares()
        }
        if (mouseOverPurpleButton == true) {
            chosenColor = "Purple"
            updateSelectedSquares()
        }
        if (mouseOverGameButton == true) {
            startGame()
        }
        if (mouseOverQuitButton == true) {
            quitGame()
        }
    }
}