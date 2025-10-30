interface GeneratedImage {
    base64: string;
    mimeType: string;
}

export const assembleVideo = (
    images: GeneratedImage[],
    audioBuffer: AudioBuffer,
    audioContext: AudioContext
): Promise<Blob> => {
    return new Promise(async (resolve, reject) => {
        const canvas = document.createElement('canvas');
        canvas.width = 1280;
        canvas.height = 720;
        const ctx = canvas.getContext('2d');

        if (!ctx) {
            return reject(new Error('Canvas context not available'));
        }

        const audioDuration = audioBuffer.duration;
        const sceneDuration = audioDuration / images.length;

        const imageElements: HTMLImageElement[] = await Promise.all(
            images.map(img => {
                // FIX: Explicitly type the Promise to ensure correct type inference for `imageElements`.
                return new Promise<HTMLImageElement>((resolve, reject) => {
                    const el = new Image();
                    el.onload = () => resolve(el);
                    el.onerror = reject;
                    el.src = `data:${img.mimeType};base64,${img.base64}`;
                });
            })
        );
        
        // @ts-ignore
        const stream = canvas.captureStream(25); // 25 FPS
        
        // Combine audio and video stream
        const audioDestination = audioContext.createMediaStreamDestination();
        const source = audioContext.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(audioDestination);
        source.start();

        const audioTrack = audioDestination.stream.getAudioTracks()[0];
        stream.addTrack(audioTrack);
        
        const recorder = new MediaRecorder(stream, { mimeType: 'video/webm; codecs=vp9,opus' });
        const chunks: Blob[] = [];
        
        recorder.ondataavailable = (e) => chunks.push(e.data);
        recorder.onstop = () => {
            // FIX: Corrected blob mime type to 'video/webm' to match the MediaRecorder configuration.
            const blob = new Blob(chunks, { type: 'video/webm' });
            resolve(blob);
        };
        recorder.onerror = (e) => reject(e);

        recorder.start();

        let currentScene = 0;
        const startTime = performance.now();

        const draw = (now: number) => {
            const elapsedTime = (now - startTime) / 1000;
            
            if (elapsedTime >= audioDuration) {
                recorder.stop();
                return;
            }

            currentScene = Math.min(Math.floor(elapsedTime / sceneDuration), images.length - 1);
            const image = imageElements[currentScene];
            const timeInScene = elapsedTime % sceneDuration;
            
            ctx.fillStyle = 'black';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            
            // Ken Burns effect
            const scale = 1 + (timeInScene / sceneDuration) * 0.1;
            const x = (canvas.width - image.width * scale) / 2;
            const y = (canvas.height - image.height * scale) / 2;

            ctx.drawImage(image, x, y, image.width * scale, image.height * scale);

            requestAnimationFrame(draw);
        };
        
        requestAnimationFrame(draw);
    });
};
