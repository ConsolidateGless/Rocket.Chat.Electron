import { ipcRenderer } from 'electron';

export default () => {
	document.addEventListener('dragover', (event) => event.preventDefault());
	document.addEventListener('drop', (event) => event.preventDefault());

	for (const eventName of ['unread-changed', 'get-sourceId', 'create-activity']) {
		window.addEventListener(eventName, (event) => ipcRenderer.sendToHost(eventName, event.detail));
	}
};
