const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
var recognition = new SpeechRecognition();
  recognition.onresult = function(event) {
	if (event.results.length > 0) {
      query.value = event.results[0][0].transcript;
	  query.form.submit();
    }
  }