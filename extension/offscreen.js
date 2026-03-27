let mediaRecorder;
let audioChunks = [];
let audioContext;
let analyser;
let dataArray;
let visualizerTimer;

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.target !== 'offscreen') return;

    if (message.type === 'START_RECORDING') {
        startRecording();
    } else if (message.type === 'STOP_RECORDING') {
        stopRecording();
    }
});

async function startRecording() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
        audioChunks = [];

        mediaRecorder.ondataavailable = e => {
            if (e.data.size > 0) audioChunks.push(e.data);
        };

        audioContext = new AudioContext();
        analyser = audioContext.createAnalyser();
        const apiSource = audioContext.createMediaStreamSource(stream);
        apiSource.connect(analyser);
        analyser.fftSize = 64; 
        const bufferLength = analyser.frequencyBinCount;
        dataArray = new Uint8Array(bufferLength);

        visualizerTimer = setInterval(() => {
            analyser.getByteFrequencyData(dataArray);
            const levels = [
                dataArray[2],
                dataArray[4],
                dataArray[6],
                dataArray[8],
                dataArray[12]
            ];
            chrome.runtime.sendMessage({ type: 'AUDIO_LEVELS', levels }).catch(() => {});
        }, 100);

        mediaRecorder.onstop = () => {
            const blob = new Blob(audioChunks, { type: 'audio/webm' });
            
            const reader = new FileReader();
            reader.onloadend = () => {
                chrome.runtime.sendMessage({ 
                    type: 'FINAL_AUDIO_DATA', 
                    data: reader.result 
                });
            };
            reader.readAsDataURL(blob);

            stream.getTracks().forEach(track => track.stop());
        };

        mediaRecorder.start();
    } catch (err) {
        console.error("Failed to start recording:", err);
    }
}

function stopRecording() {
    if (visualizerTimer) clearInterval(visualizerTimer);
    if (audioContext) audioContext.close();
    
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
        mediaRecorder.stop();
    }
}
