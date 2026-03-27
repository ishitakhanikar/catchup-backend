let recordingTimer = null;
let seconds = 0;
let isRecording = false;
let recordedDataUrl = null;
let isGenerating = false;
let abortController = null;

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'START_RECORDING') {
        startRecording()
            .then(() => sendResponse({success: true}))
            .catch(e => sendResponse({error: e.message}));
        return true; 
    } else if (message.type === 'STOP_RECORDING') {
        stopRecording()
            .then(() => sendResponse({success: true}))
            .catch(e => sendResponse({error: e.message}));
        return true;
    } else if (message.type === 'GET_STATE') {
        sendResponse({ isRecording, seconds, recordedDataUrl, isGenerating });
    } else if (message.type === 'FINAL_AUDIO_DATA') {
        recordedDataUrl = message.data;
        chrome.runtime.sendMessage({ type: 'RECORDING_COMPLETE', data: message.data }).catch(() => {});
        isRecording = false;
        clearInterval(recordingTimer);
    } else if (message.type === 'CLEAR_RECORDING') {
        recordedDataUrl = null;
        sendResponse({success: true});
    } else if (message.type === 'GENERATE_MOM') {
        generateMoMInBackground(message.agenda, message.audioDataUrl, message.fileName);
        sendResponse({ success: true });
    } else if (message.type === 'CANCEL_MOM') {
        if (abortController) {
            abortController.abort();
            isGenerating = false;
        }
        sendResponse({ success: true });
    }
});

async function setupOffscreenDocument() {
    const existingContexts = await chrome.runtime.getContexts({
        contextTypes: ['OFFSCREEN_DOCUMENT']
    });
    if (existingContexts.length > 0) return;

    await chrome.offscreen.createDocument({
        url: 'offscreen.html',
        reasons: ['USER_MEDIA'],
        justification: 'Recording audio data from microphone'
    });
}

async function startRecording() {
    if (isRecording) return;
    recordedDataUrl = null;
    await setupOffscreenDocument();
    
    await chrome.runtime.sendMessage({
        target: 'offscreen',
        type: 'START_RECORDING'
    });
    
    isRecording = true;
    seconds = 0;
    
    recordingTimer = setInterval(() => {
        seconds++;
        chrome.runtime.sendMessage({ type: 'TIMER_UPDATE', seconds }).catch(() => {});
    }, 1000);
}

async function stopRecording() {
    if (!isRecording) return;
    clearInterval(recordingTimer);
    
    await chrome.runtime.sendMessage({
        target: 'offscreen',
        type: 'STOP_RECORDING'
    });
}

async function generateMoMInBackground(agendaText, audioDataUrl, audioFileName) {
    if (isGenerating) return;
    isGenerating = true;
    abortController = new AbortController();
    chrome.runtime.sendMessage({ type: 'GENERATING_UPDATE', isGenerating: true }).catch(() => {});

    try {
        const formData = new FormData();
        formData.append('agenda', agendaText);
        
        let arr = audioDataUrl.split(','), mime = arr[0].match(/:(.*?);/)[1],
            bstr = atob(arr[1]), n = bstr.length, u8arr = new Uint8Array(n);
        while(n--){
            u8arr[n] = bstr.charCodeAt(n);
        }
        const audioBlob = new Blob([u8arr], {type:mime});
        
        formData.append('audio', audioBlob, audioFileName);

        const response = await fetch('https://catchup-backend-production.up.railway.app/api/v1/generate-mom', {
            method: 'POST',
            body: formData,
            signal: abortController.signal
        });

        if (!response.ok) {
            let detailStr = 'Server returned an error';
            try {
                const errorData = await response.json();
                if (errorData.detail) detailStr = errorData.detail;
            } catch(e) {}
            throw new Error(detailStr);
        }

        const pdfBlob = await response.blob();
        
        // V3 Service-Worker friendly byte array to base64 DataURI converter
        const buffer = await pdfBlob.arrayBuffer();
        let binary = '';
        const bytes = new Uint8Array(buffer);
        for (let i = 0; i < bytes.byteLength; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        const dataUrl = 'data:application/pdf;base64,' + btoa(binary);

        try {
            chrome.downloads.download({
                url: dataUrl,
                filename: 'CatchUp_Minutes_of_Meeting.pdf',
                saveAs: false
            });
        } catch (err) {
            console.error("Download Error:", err);
        }
        
        try {
            chrome.notifications.create({
                type: 'basic',
                iconUrl: 'icon-128.png', // Must match exactly
                title: 'CatchUp! MoM Ready',
                message: 'Your Minutes of Meeting has been successfully created and saved to your Downloads folder!'
            });
        } catch (err) {
            console.error("Notification Error:", err);
        }

        chrome.runtime.sendMessage({ type: 'GENERATING_UPDATE', isGenerating: false, success: true }).catch(() => {});
    } catch (err) {
        if (err.name === 'AbortError') {
            console.log("Generation successfully cancelled by user.");
            chrome.runtime.sendMessage({ type: 'GENERATING_UPDATE', isGenerating: false, aborted: true }).catch(() => {});
            return;
        }
        console.error("Background Generation Error:", err);
        chrome.notifications.create({
            type: 'basic',
            iconUrl: 'icon-128.png',
            title: 'CatchUp! Generation Failed',
            message: 'Error generating MoM: ' + err.message
        });
        chrome.runtime.sendMessage({ type: 'GENERATING_UPDATE', isGenerating: false, success: false, error: err.message }).catch(() => {});
    } finally {
        isGenerating = false;
        abortController = null;
    }
}
