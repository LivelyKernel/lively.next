import { Morph, component, part, easings } from 'lively.morphic';
import { promise } from 'lively.lang';
import { Color, pt } from 'lively.graphics';
import {
  WebGLRenderer, Scene, AmbientLight, PerspectiveCamera, SpotLight, Color as ThreeColor,
  TextureLoader, BackSide, MeshBasicMaterial, MeshPhongMaterial, SphereGeometry, Mesh
} from 'esm://cache/three';
import { Canvas } from 'lively.components/canvas.js';
import { World } from 'lively.morphic/world.js';
import { connect } from 'lively.bindings';

// this pulls in a bunch of code
import { WorldBrowser } from 'lively.ide/studio/world-browser.cp.js';

class WebGLCanvas extends Canvas {
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
      // setTimeout(() => this.owner.context.drawImage(this.renderer.getContext().canvas, 0, 0));
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

  limitLoop (fn, fps) {
    let then = Date.now(); const self = this;

    // custom fps, otherwise fallback to 60
    let loop;

    return (loop = () => {
      self.renderLoop = requestAnimationFrame(loop);

      const now = Date.now();
      const delta = now - then;
      const interval = (1000 / (fps || this.fps));

      if (delta > interval) {
        // Update time
        // now - (delta % interval) is an improvement over just
        // using then = now, which can end up lowering overall fps
        then = now - (delta % interval);

        // call the fn
        fn();
        if (self.firstFrameRendered) { self.firstFrameRendered(); }
      }
    })(0);
  }
}

class Globe extends WebGLCanvas {
  async fullyLoaded () {
    let p;
    ({ resolve: this.firstFrameRendered, promise: p } = promise.deferred());
    await p;
  }

  async onLoad () {
    await this.whenRendered();
    this.renderGlobe();
    await this.fullyLoaded();
    await promise.delay(500);
    this.get('cover').animate({
      opacity: 0,
      easing: easings.inOutCubic
    });
    this.relayout();
    connect(this, 'extent', this, 'onExtentChanged');
  }

  renderGlobe () {
    this.stopAnimation();
    this.withContextDo(webglEl => {
    	const width = this.width;
    	const height = this.height;
      const textureDir = '/lively.morphic/assets/globe-textures/';

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
    				specular: new ThreeColor('grey')
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

  beforePublish () {
    this.get('cover').opacity = 1;
  }

  onExtentChanged () {
    super.onExtentChanged();
    this.get('cover').extent = this.extent;
  }
}

class WorldLandingPage extends Morph {
  static get properties () {
    return {
      title: {
        derived: true,
        get () {
          return `lively.next (${document.location.hostname})`;
        }
      },
      loadingScreen: {}
    };
  }

  get __loading_html__ () {
    return `
      <style>
        ${this.loadingScreen.cssDeclaration}
      </style>
      ${this.loadingScreen.html}
    `;
  }

  get commands () {
    return [
      {
        name: 'resize on client',
        exec: () => {
          this.relayout();
        }
      }
    ];
  }

  relayout () {
    $world._cachedWindowBounds = null;
    document.body.style.overflowY = 'hidden';
    this.setBounds($world.windowBounds());
    this.getSubmorphNamed('globe').extent = this.extent;
    const worldList = this.getSubmorphNamed('a project browser');
    if (worldList) worldList.center = this.extent.scaleBy(0.5);
  }


  beforePublish () {
    const worldList = this.getSubmorphNamed('a project browser');
    if (worldList) worldList.remove();
  }

  async onLoad () {
    await this.whenRendered();
    if (!lively.FreezerRuntime) return;
    $world.fill = Color.black;
    document.body.style.background = Color.black;
    this.showWorldList();
  }

  async showWorldList () {
    const dashboard = this.getSubmorphNamed('a poject browser') || this.addMorph(part(WorldBrowser, { name: 'a project browser', viewModel: { showCloseButton: false } }));
    this.reset();
    dashboard.showCloseButton = false;
    dashboard.extent = pt(1110, 800).minPt(this.extent.subPt(pt(50, 150)));
    dashboard.center = this.innerBounds().center();
    await dashboard.allFontsLoaded();
    dashboard.animate({
      opacity: 1, duration: 300
    });
    dashboard.hasFixedPosition = false;
  }

  reset () {
    const dashboard = this.getSubmorphNamed('a project browser');
    dashboard.opacity = 0;
    dashboard.center = this.innerBounds().center();
  }
}

const LandingPage = component({
  type: WorldLandingPage,
  name: 'landing page',
  extent: pt(500, 500),
  fill: Color.black,
  submorphs: [
    {
      name: 'globe',
      type: Globe,
      contextType: 'webgl',
      extent: pt(500, 500),
      fps: 60
    }, {
      name: 'cover',
      fill: Color.black,
      extent: pt(500, 500)
    }
  ]
});

export async function main () {
  const lp = part(LandingPage);
  lp.respondsToVisibleWindow = true;
  $world.addMorph(lp);
  lp.relayout();
}

export const TITLE = 'lively.next';

export const WORLD_CLASS = World;

export const EXCLUDED_MODULES = [
  'lively.collab',
  'mocha-es6', 'mocha', 'picomatch', // references old lgtg that breaks the build
  'path-is-absolute', 'fs.realpath', 'rollup', // has a dist file that cant be parsed by rollup
  '@babel/preset-env',
  '@babel/plugin-syntax-import-meta',
  '@rollup/plugin-json',
  '@rollup/plugin-commonjs',
  'rollup-plugin-polyfill-node',
  'babel-plugin-transform-es2015-modules-systemjs'
];
