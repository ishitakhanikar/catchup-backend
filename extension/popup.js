document.addEventListener('DOMContentLoaded', async () => {
    // Agenda Default Logic
    const agendaInput = document.getElementById('agenda');
    const setDefaultBtn = document.getElementById('set-default-btn');
    const defaultSavedMsg = document.getElementById('default-saved-msg');

    chrome.storage.local.get(['defaultAgenda'], (result) => {
        if (result.defaultAgenda) {
            agendaInput.value = result.defaultAgenda;
        }
    });

    setDefaultBtn.addEventListener('click', () => {
        const text = agendaInput.value;
        chrome.storage.local.set({ defaultAgenda: text }, () => {
            defaultSavedMsg.classList.remove('hidden');
            setTimeout(() => defaultSavedMsg.classList.add('hidden'), 2000);
        });
    });

    // Tabs logic
    const tabs = document.querySelectorAll('.tab');
    const tabContents = document.querySelectorAll('.tab-content');

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            tabContents.forEach(c => c.classList.add('hidden'));

            tab.classList.add('active');
            document.getElementById(`${tab.dataset.tab}-content`).classList.remove('hidden');
        });
    });

    // File Input Logic
    const fileInput = document.getElementById('audio-file');
    const fileNameDisplay = document.getElementById('file-name-display');
    const generateBtn = document.getElementById('generate-btn');

    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            fileNameDisplay.textContent = e.target.files[0].name;
            generateBtn.disabled = false;
        } else {
            fileNameDisplay.textContent = 'No file selected';
            generateBtn.disabled = true;
        }
    });

    // Recording Logic - sync with Background Worker
    const recordBtn = document.getElementById('record-btn');
    const recordStatus = document.getElementById('record-status');
    const btnText = recordBtn.querySelector('.btn-text');
    let recordedBlob = null;
    let isRecordingLocal = false;

    // Helper: Format timer
    function formatTime(seconds) {
        const mins = Math.floor(seconds / 60).toString().padStart(2, '0');
        const secs = (seconds % 60).toString().padStart(2, '0');
        return `${mins}:${secs}`;
    }

    // Helper: Convert base64 data URL back to Blob
    function dataURLtoBlob(dataurl) {
        if (!dataurl) return null;
        let arr = dataurl.split(','), mime = arr[0].match(/:(.*?);/)[1],
            bstr = atob(arr[1]), n = bstr.length, u8arr = new Uint8Array(n);
        while(n--){
            u8arr[n] = bstr.charCodeAt(n);
        }
        return new Blob([u8arr], {type:mime});
    }

    // Initialize state from background
    chrome.runtime.sendMessage({ type: 'GET_STATE' }, (response) => {
        if (response.isRecording) {
            isRecordingLocal = true;
            recordBtn.classList.add('recording');
            btnText.textContent = 'Stop Recording';
            recordStatus.textContent = `Recording... ${formatTime(response.seconds)}`;
            recordStatus.classList.remove('hidden');
            generateBtn.disabled = true;
        } else if (response.recordedDataUrl) {
            recordedBlob = dataURLtoBlob(response.recordedDataUrl);
            recordStatus.textContent = 'Recording saved. Ready to generate.';
            recordStatus.classList.remove('hidden');
            generateBtn.disabled = false;
        }

        if (response.isGenerating) {
            const loadingSection = document.getElementById('loading');
            const generateBtn = document.getElementById('generate-btn');
            const resultSection = document.getElementById('result');
            loadingSection.classList.remove('hidden');
            generateBtn.classList.add('hidden');
            resultSection.classList.add('hidden');
        }
    });

    // Listen for background updates
    chrome.runtime.onMessage.addListener((message) => {
        if (message.type === 'TIMER_UPDATE') {
            recordStatus.textContent = `Recording... ${formatTime(message.seconds)}`;
        } else if (message.type === 'RECORDING_COMPLETE') {
            recordedBlob = dataURLtoBlob(message.data);
            isRecordingLocal = false;
            recordBtn.classList.remove('recording');
            btnText.textContent = 'Start Recording';
            recordStatus.textContent = 'Recording saved. Ready to generate.';
            document.getElementById('visualizer').classList.add('hidden');
            generateBtn.disabled = false;
        } else if (message.type === 'AUDIO_LEVELS') {
            const visualizer = document.getElementById('visualizer');
            if (visualizer.classList.contains('hidden')) {
                visualizer.classList.remove('hidden');
            }
            const bars = document.querySelectorAll('#visualizer .bar');
            message.levels.forEach((val, i) => {
                if (bars[i]) {
                    const height = Math.max(4, (val / 255) * 20);
                    bars[i].style.height = `${height}px`;
                }
            });
        }
    });

    recordBtn.addEventListener('click', async () => {
        if (!isRecordingLocal) {
            // Check for mic permissions explicitly before telling background to start
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                // We don't need it here, just needed to prompt permission in the main window
                stream.getTracks().forEach(track => track.stop());
            } catch(err) {
                alert("Microphone access denied. Please allow it.");
                return;
            }

            chrome.runtime.sendMessage({ type: 'START_RECORDING' }, (res) => {
                if (res && res.error) {
                    alert('Error starting recording: ' + res.error);
                } else {
                    isRecordingLocal = true;
                    recordBtn.classList.add('recording');
                    btnText.textContent = 'Stop Recording';
                    recordStatus.textContent = `Recording... 00:00`;
                    recordStatus.classList.remove('hidden');
                    generateBtn.disabled = true;
                    recordedBlob = null;
                }
            });
        } else {
            chrome.runtime.sendMessage({ type: 'STOP_RECORDING' });
            recordStatus.textContent = `Saving...`;
            document.getElementById('visualizer').classList.add('hidden');
            isRecordingLocal = false;
            recordBtn.classList.remove('recording');
            btnText.textContent = 'Start Recording';
        }
    });

    // Cancel logic
    document.getElementById('cancel-btn').addEventListener('click', () => {
        chrome.runtime.sendMessage({ type: 'CANCEL_MOM' });
    });

    // Generate Button Logic
    const loadingSection = document.getElementById('loading');
    const resultSection = document.getElementById('result');

    generateBtn.addEventListener('click', async () => {
        const agendaText = document.getElementById('agenda').value;
        if (!agendaText.trim()) {
            alert("Please provide a meeting agenda so the AI can focus on key points.");
            return;
        }

        const activeTab = document.querySelector('.tab.active').dataset.tab;
        let blobOrFile = null;
        let filename = 'recording.webm';

        if (activeTab === 'upload' && fileInput.files.length > 0) {
            blobOrFile = fileInput.files[0];
            filename = blobOrFile.name;
        } else if (activeTab === 'record' && recordedBlob) {
            blobOrFile = recordedBlob;
        } else {
            alert("Please record or select an audio file first.");
            return;
        }

        loadingSection.classList.remove('hidden');
        generateBtn.classList.add('hidden');

        // Convert Blob to Base64 to send to background
        const reader = new FileReader();
        reader.onloadend = () => {
            chrome.runtime.sendMessage({
                type: 'GENERATE_MOM',
                agenda: agendaText,
                audioDataUrl: reader.result,
                fileName: filename
            });
        };
        reader.readAsDataURL(blobOrFile);
    });

    chrome.runtime.onMessage.addListener((message) => {
        if (message.type === 'GENERATING_UPDATE') {
            if (message.isGenerating) {
                loadingSection.classList.remove('hidden');
                generateBtn.classList.add('hidden');
                resultSection.classList.add('hidden');
            } else {
                loadingSection.classList.add('hidden');
                if (message.aborted) {
                    generateBtn.classList.remove('hidden');
                } else if (message.success) {
                    resultSection.innerHTML = "<h3>✓ Minutes of Meeting Downloaded!</h3><p style='color:#8e8e93; font-size:14px; margin-top:8px'>Check your downloads folder or native alerts.</p>";
                    resultSection.classList.remove('hidden');
                    recordedBlob = null;
                } else {
                    generateBtn.classList.remove('hidden');
                    alert("Error generating MoM: " + message.error);
                }
            }
        }
    });
});
