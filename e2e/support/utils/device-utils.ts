import { copyFile } from 'fs';

export async function showWebcamVideo(name: string) {
    await new Promise((resolve, reject) => {
        copyFile(`/srv/project/e2e/support/samples/webcam_videos/${name}.y4m`, '/tmp/e2e.y4m', error => {
            if (error) {
                reject(error);
            } else {
                resolve();
            }
        });
    });
}
