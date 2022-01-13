import THREE from 'https://dev.jspm.io/three@0.126';
import { Canvas } from './canvas.js';
const { Scene, SpotLight, MeshBasicMaterial, BackSide, Color, MeshPhongMaterial, SphereGeometry, Mesh, AmbientLight, WebGLRenderer, PerspectiveCamera, TextureLoader } = THREE;

export class WebGLCanvas extends Canvas {
  static get properties () {
    return {
      fps: {}
    };
  }

  get context () {
    if (navigator.webdriver) {
      return this._canvas && this._canvas.getContext('2d');
    }
    return this._canvas && this._canvas.getContext(this.contextType, {
      preserveDrawingBuffer: true
    });
  }

  restoreContent (old_canvas, new_canvas) {
    if (this.renderer && old_canvas && old_canvas !== new_canvas) {
      this.owner.context.drawImage(this.renderer.getContext().canvas, 0, 0);
      this.renderer = new WebGLRenderer({ context: this.context, antialiasing: true });
      this.renderer.setSize(this.width, this.height);
    }
  }

  onExtentChanged () {}

  relayout () {
    if (this.renderLoop) {
      setTimeout(() => this.owner.context.drawImage(this.renderer.getContext().canvas, 0, 0));
      this.renderer.setSize(this.width, this.height);
      this.camera.aspect = this.width / this.height;
      this.camera.updateProjectionMatrix();
    }
  }

  stopAnimation () {
    if (this.renderLoop) {
      cancelAnimationFrame(this.renderLoop);
      this.renderer.dispose();
    }
  }

  // this.renderGlobe()

  renderGlobe () {
    this.stopAnimation();
    this.withContextDo(webglEl => {
    	const width = this.width;
    		 const height = this.height;

      const textureDir = 'assets/globe-textures/';

    	// Earth params
    	const radius = 0.5;
    		   const segments = 32;
    		   const rotation = 5.2;

    	const scene = new Scene();

    	const camera = new PerspectiveCamera(45, width / height, 0.01, 1000);
    	camera.position.z = 1;
      camera.position.x = 0.4;
      camera.position.y = 0.25;
      this.camera = camera;

    	scene.add(new AmbientLight(0x333333));

    	const light = new SpotLight(0xffffff, 1, 200, Math.PI / 2, 1);
    	light.position.set(1, 1, 0);
      light.castShadow = true;
      light.shadow.mapSize.width = 1024; // default 512
      light.shadow.mapSize.height = 1024; // default 512
      light.shadow.camera.near = 10; // default 0.5
      light.shadow.camera.far = 100;
      light.shadow.bias = 0.01;
    	scene.add(light);

      const sphere = createSphere(radius, segments);
    	sphere.rotation.y = rotation;
    	scene.add(sphere);

      const clouds = createClouds(radius, segments);
    	clouds.rotation.y = rotation;
    	scene.add(clouds);

    	const stars = createStars(90, 64);
    	scene.add(stars);

      this.renderer = new WebGLRenderer({ context: webglEl, antialias: true });
    	this.renderer.setSize(width, height);
    	const render = () => {
        if (!document.body.contains(this.renderer.getContext().canvas)) {
          if (this.removeScheduled) return;
          this.removeScheduled = setTimeout(() => {
            if (document.body.contains(this.renderer.getContext().canvas)) return;
            this.stopAnimation();
          }, 5000);
        }
    		sphere.rotation.y += 0.0005;
    		clouds.rotation.y += 0.0005;
    		this.renderer.render(scene, camera);
    	};

      this.limitLoop(render);

      // this.animate({
      //   height: this.height,
      //   easing: easings.outQuint,
      //   customTween: (p) => {
      //     this.camera.position.z = 1 - (1 - p) * .9
      //     this.camera.position.x = .4 + (1 - p) * 0.2
      //     this.camera.position.y = .25 + (1 - p) * 0.2
      //   },
      //   duration: 15000
      // });

      this.camera.position.z = 1;
      this.camera.position.x = 0.4;
      this.camera.position.y = 0.25;

    	function createSphere (radius, segments) {
        const loader = new TextureLoader();
    		return new Mesh(
    			new SphereGeometry(radius, segments, segments),
    			new MeshPhongMaterial({
    				map: loader.load(textureDir + '2_no_clouds_4k.jpg'),
    				bumpMap: loader.load(textureDir + 'elev_bump_4k.jpg'),
    				bumpScale: 0.005,
            shininess: 5,
    				specularMap: loader.load(textureDir + 'water_4k.png'),
    				specular: new Color('grey')
    			})
    		);
    	}

    	function createClouds (radius, segments) {
        const loader = new TextureLoader();
    		return new Mesh(
    			new SphereGeometry(radius + 0.003, segments, segments),
    			new MeshPhongMaterial({
    				map: loader.load(textureDir + 'fair_clouds_4k.png'),
    				transparent: true
    			})
    		);
    	}

    	function createStars (radius, segments) {
        const loader = new TextureLoader();
    		return new Mesh(
    			new SphereGeometry(radius, segments, segments),
    			new MeshBasicMaterial({
    				map: loader.load(textureDir + '/galaxy_starfield.png'),
    				side: BackSide
    			})
    		);
    	}
    });
  }

  limitLoop (fn, fps) {
    // Use var then = Date.now(); if you
    // don't care about targetting < IE9
    let then = new Date().getTime(); const globe = this;

    // custom fps, otherwise fallback to 60
    let loop;

    return (loop = (time) => {
      globe.renderLoop = requestAnimationFrame(loop);

      // again, Date.now() if it's available
      const now = new Date().getTime();
      const delta = now - then;
      const interval = (1000 / (fps || this.fps));

      if (delta > interval) {
        // Update time
        // now - (delta % interval) is an improvement over just
        // using then = now, which can end up lowering overall fps
        then = now - (delta % interval);

        // call the fn
        fn();
        globe.firstFrameRendered = true;
      }
    })(0);
  }
}
