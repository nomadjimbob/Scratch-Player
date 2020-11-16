"use strict";
window.WIDTH = 480;
window.HEIGHT = 360;
const state = {
    mouseDown: false,
    mouseDownTimeoutId: null,
    mouseDownPosition: null,
    isDragging: false,
    dragOffset: null,
    dragId: null
};
const requestStack = [];

// 定义VirtualMachine
const vm = new VirtualMachine();

// 定义舞台渲染工具   RenderWebGL
const canvas = document.getElementById('ocanvas');
const render = new ScratchRender(canvas);
vm.attachRenderer(render);

// 为VirtualMachine设置存储器
const storage = new ScratchStorage();
const AssetType = storage.AssetType;
vm.attachStorage(storage);

// 定义音频处理器
const audioEngine = new AudioEngine();
vm.attachAudioEngine(audioEngine);

// 为VirtualMachine设置svgRenderer
vm.attachV2SVGAdapter(new ScratchSVGRenderer.SVGRenderer());
vm.attachV2BitmapAdapter(new ScratchSVGRenderer.BitmapAdapter());

// 摄像头相关
class VideoProvider {
    constructor () {
        this.mirror = true;
        this._frameCacheTimeout = 16;
        this._video = null;
        this._track = null;
        this._workspace = [];
    }

    static get FORMAT_IMAGE_DATA () {return 'image-data';}
    static get FORMAT_CANVAS () {return 'canvas';}
    static get DIMENSIONS () {return [WIDTH, HEIGHT];}
    static get ORDER () { return 1; }
    get video () { return this._video; }

    enableVideo () { this.enabled = true; return this._setupVideo(); }
    disableVideo () {
        this.enabled = false;
        if (this._singleSetup) {
            this._singleSetup
                .then(this._teardown.bind(this))
                .catch(err => this.onError(err));
        }
    }
    _teardown () {
        if (this.enabled === false) {
            const disableTrack = requestDisableVideo();
            this._singleSetup = null;
            this._video = null;
            if (this._track && disableTrack) {
                this._track.stop();
            }
            this._track = null;
        }
    }
    getFrame ({
        dimensions = VideoProvider.DIMENSIONS,
        mirror = this.mirror,
        format = VideoProvider.FORMAT_IMAGE_DATA,
        cacheTimeout = this._frameCacheTimeout
    }) {
        if (!this.videoReady || !this.enabled) {
            return null;
        }
        const [width, height] = dimensions;
        const workspace = this._getWorkspace({dimensions, mirror: Boolean(mirror)});
        const {videoWidth, videoHeight} = this._video;
        const {canvas, context, lastUpdate, cacheData} = workspace;
        const now = Date.now();

        if (lastUpdate + cacheTimeout < now) {

            if (mirror) {
                context.scale(-1, 1);
                context.translate(width * -1, 0);
            }

            context.drawImage(this._video,
                0, 0, videoWidth, videoHeight,
                0, 0, width, height
            );

            context.setTransform(1, 0, 0, 1, 0, 0);
            workspace.lastUpdate = now;
        }

        if (!cacheData[format]) {
            cacheData[format] = {lastUpdate: 0};
        }
        const formatCache = cacheData[format];

        if (formatCache.lastUpdate + cacheTimeout < now) {
            if (format === VideoProvider.FORMAT_IMAGE_DATA) {
                formatCache.lastData = context.getImageData(0, 0, width, height);
            } else if (format === VideoProvider.FORMAT_CANVAS) {
                formatCache.lastUpdate = Infinity;
                formatCache.lastData = canvas;
            } else {
                console.error(`video io error - unimplemented format ${format}`);
                formatCache.lastUpdate = Infinity;
                formatCache.lastData = null;
            }

            formatCache.lastUpdate = Math.max(workspace.lastUpdate, formatCache.lastUpdate);
        }

        return formatCache.lastData;
    }
    onError (error) { console.error('Unhandled video io device error', error); }
    _setupVideo () {
        if (this._singleSetup) {
            return this._singleSetup;
        }

        this._singleSetup = requestVideoStream({
            width: {min: WIDTH, ideal: 480 * WIDTH / HEIGHT},
            height: {min: HEIGHT, ideal: 480}
        })
            .then(stream => {
                this._video = document.createElement('video');

                try {
                    this._video.srcObject = stream;
                } catch (error) {
                    this._video.src = window.URL.createObjectURL(stream);
                }
                this._video.play();
                this._track = stream.getTracks()[0];
                return this;
            })
            .catch(error => {
                this._singleSetup = null;
                this.onError(error);
            });

        return this._singleSetup;
    }

    get videoReady () {
        if (!this.enabled) {
            return false;
        }
        if (!this._video) {
            return false;
        }
        if (!this._track) {
            return false;
        }
        const {videoWidth, videoHeight} = this._video;
        if (typeof videoWidth !== 'number' || typeof videoHeight !== 'number') {
            return false;
        }
        if (videoWidth === 0 || videoHeight === 0) {
            return false;
        }
        return true;
    }

    _getWorkspace ({dimensions, mirror}) {
        let workspace = this._workspace.find(space => (
            space.dimensions.join('-') === dimensions.join('-') &&
            space.mirror === mirror
        ));
        if (!workspace) {
            workspace = {
                dimensions,
                mirror,
                canvas: document.createElement('canvas'),
                lastUpdate: 0,
                cacheData: {}
            };
            workspace.canvas.width = dimensions[0];
            workspace.canvas.height = dimensions[1];
            workspace.context = workspace.canvas.getContext('2d');
            this._workspace.push(workspace);
        }
        return workspace;
    }
}

var vid = new VideoProvider();
vm.setVideoProvider(vid);

attachMouseEvents(canvas);
