/* global process */
import { ObjectDBInterface, ObjectDB } from 'lively.storage';
import { resource } from 'lively.resources';
import { HeadlessSession } from 'lively.headless';
import { string, promise } from 'lively.lang';

const errorLog = [];

export default class ComponentsBrowser {
  /*

    This subserver handles the indexing and caching of exported master components of worlds.

    ===========
    Background:
    ===========
    Parts are shared between worlds and users by being declared as master component and saved with that world.
    They can then be imported into other worlds via the styleguide:// or part:// identifiers.
    Import via styleguide: This directly 1:1 copies over the master component into the world. This should solely be used to style morphs in a world.
    Import via part: This creates an instance of the component and copies it over to the world. Should be used when instantiation via class and master specification is not convenient. For instance many parts do not come with a "setup" routine of their UI elements. In those cases it is easier to use the part:// identifier and copy state, instead of writing a custom UI setup routine and assigning the part as a master.
    Note: If you really dread writing code that sets up the submorphs or a part, yet you work from code, you can set "initializeSubmorphs: true" on the master. This will try to replicate the submorph hierarchy alongside the styled properties in your morph. Note that this does not initialize references or connections. If those should be preserved, use the part:// identifier.
    When should you choose which? Each of them provide different levels of convenience. What matters if you are a creator that prefers coming from "code" or from "visual elements". When you are more code affine, you will most often resort to just designing UI elments in lively and then references them in your code via the styleguide:// notation. If you like to go all in and prefer a part centric approach, you will most likely never really touch styleguide:// identifiers. Rather other people will then have a great time using your creations by importinf them via the part:// identifier.
    In that sense styleguide:// is an abstraction for a more "old school" way of programming or for code that lives in plain npm packages but needs to reference master components from lively.

    Behind the scenes both part:// and styleguide:// identifier first resort to this subserver if they go to resolve the morph that they are referring to. If this server fails to resolve the morph, they perform a manual world and morph extraction, which is much more expensive and can also lead to failed resolutions of the morphicdb is not in a consistent state. (for instance a user forgot to update the db from remote or assumes a world to be present that is in fact not inside the DB).
    Worlds that always need to be present in all lively installations (core styleguides) should therefore always be versioned as JSON and managed via the GIT repo.
    This Components browser serves as a unifying interface that abstracts away wether a world is stored in a JSON (not version managed) or managed via the morphic database (versioning enabled).

    ===========
    What this subserver does
    ===========
    For the effecient and responsive querying and importing of master components it is too expensive to load and deserialize every world that exports these.
    To optimize this, the ComponentsBrowser subserver scans the morphic database as well as dedicated custom folders with world snapshots (.json).
    Worlds inside the database are only considered, if they have specified the "styleguide" keyword in their tags. If not, they are NOT scanned for exported components and therefore do not appear in the query of the component browser.
    JSON snapshots that are contained inside dedicated folders are all deemed worthy, and scanned for exported master components even if they dont have any.

    This server also handles the proper preview generation of master components. All solutions that try to generate screenshots from visual objects inside the browser have varying reliability issues, most often problems with fontloading or highly complex embedded widgets inside iframes (google maps). The best screenshot mechanism to date is therefore using a headless chrome (puppeteer) and taking screenshots of the exported parts in isolation. When indexing and extracting exported components for quick access this subserver also creates a dedicated screenshot of each exported component that is stored alongside the snapshot itself + some meta info.

  */

  async setup (livelyServer) {
    // fixme: configure these from the config file
    this.customDirs = ['./lively.morphic/styleguides/'];
    this.cacheDir = './components_cache/';

    if (!await this.getCacheDir().exists()) { this.refresh(); }
  }

  getCacheDir () {
    const baseUrl = 'file://' + process.cwd(); // assume we are running inside the lively.server folder
    return resource(baseUrl + '/../').join(this.cacheDir).withRelativePartsResolved();
  }

  async fetchWorlds () {
    let worlds;
    const attempts = 0;
    try {
      await ObjectDBInterface.ensureDB({
        db: 'lively.morphic/objectdb/morphicdb',
        snapshotLocation: '/lively.morphic/objectdb/morphicdb/snapshots'
      });
      worlds = await ObjectDBInterface.fetchCommits({
        db: 'lively.morphic/objectdb/morphicdb',
        type: 'world'
      });
    } catch (err) {
	      console.log(err);
    }
    if (!worlds) {
      console.log('[ComponentsBrowser]: Failed to load worlds from database');
      return [];
    }
    return worlds;
  }

  async refresh (worldToUpdate = false) {
    // if worldName is specified, then we only update that particular world
    const baseUrl = 'file://' + process.cwd(); // assume we are running inside the lively.server folder
    const worlds = await this.fetchWorlds();
    // always update the world to update
    const allStyleguidesInDb = worlds.filter(commit => commit.name == worldToUpdate || commit.tags.includes('styleguide')).map(snap => snap.name);
    const additionalStyleguidesInFolders = [];
    const cacheDir = this.getCacheDir(); // ensure?
    await cacheDir.ensureExistance();
    let dir;
    for (const relPath of this.customDirs) {
      dir = resource(baseUrl + '/../').join(relPath).withRelativePartsResolved();
      const snapshots = await dir.dirList();
      additionalStyleguidesInFolders.push(...snapshots.filter(d => !d.url.endsWith('.br.json') && !allStyleguidesInDb.includes(d.name().replace('.json', ''))).map(d =>
        [
          d.name().replace('.json', ''),
          d.url.replace(resource(baseUrl + '/../').withRelativePartsResolved().url, '')
        ]
      )
      );
    }

    const urlFor = (name, json = false) =>
      json
        ? `http://localhost:9011/worlds/load?file=${encodeURIComponent(name)}&fastLoad=true&showsUserFlap=false`
        : `http://localhost:9011/worlds/load?name=${encodeURIComponent(name)}&fastLoad=true&showsUserFlap=false`;

    this.headlessSession = new HeadlessSession();

    // fire up the headless chrome browser
    for (const [worldName, jsonPath] of [...allStyleguidesInDb.map(m => [m]), ...additionalStyleguidesInFolders]) {
      if (worldToUpdate && worldName != worldToUpdate) continue;
      if (worldName == 'SystemIDE') continue;
      console.log('[ComponentsBrowser] indexing ' + worldName);
      try {
        await this.headlessSession.open(
          jsonPath ? urlFor(jsonPath, true) : urlFor(worldName),
          (sess) => sess.runEval(`$world.name == '${worldName}' || window.__loadingError__`)
        );

        if (await this.headlessSession.runEval('window.__loadingError__')) {
          console.log('[ComponentsBrowser] Failed indexing ' + worldName);
          continue;
        }

        await this.headlessSession.page.emulate({ viewport: { width: 1000, height: 1000, deviceScaleFactor: 2 }, userAgent: 'Chrome' });

        // clear loading indicator if present
        await this.headlessSession.runEval(`
          window.worldLoadingIndicator.remove();
          await $world.execCommand("resize to fit window");
          await $world.whenRendered();
        `);
        // process.exit()
        const db = await ObjectDB.find('lively.morphic/objectdb/morphicdb');
        const commitDB = await db._commitDB();
        const commit = worlds.find(commit => commit.name == worldName);
        if (commit) {
          const preview = await this.headlessSession.page.screenshot({ encoding: 'base64', clip: { x: 0, y: 0, width: 1000, height: 1000 } });
          await commitDB.mixin(commit._id, { preview: 'data:image/png;base64,' + preview }); // update the peview
        }

        const listedComponents = await this.headlessSession.runEval(`
          this.__listedComponents__ = $world.getListedComponents().filter(c => !$world.hiddenComponents.includes(c.name));
          this.__listedComponents__.map(m => m.name);
        `);

        await promise.delay(2000);

        const worldFolder = cacheDir.join(worldName + '/');
        if (await worldFolder.exists()) await worldFolder.remove(); // always make sure to start form clean slate

        // fixme: remove deleted worlds?

        for (let i = 0; i < listedComponents.length; i++) {
          const [componentName, screenshotSize] = await this.headlessSession.runEval(`
            let component = window.__currentComponent__ = this.__listedComponents__.pop();
            let res;
            if ($world.get('lively top bar'))
              $world.get('lively top bar').visible = false;
            document.body.style.backgroundColor = "transparent" 
            $world.opacity = 0;
            $world.withAllSubmorphsSelect(m => m.hasFixedPosition && m.owner == $world)
                  .forEach(m => m.opacity = 0);
            if (component) {
              component.openInWorld();
              if (component.master) await component.master.whenApplied();
              component.opacity = 1;
              component._origOwner = component.owner;
              component._origPos = component.position;
              component.hasFixedPosition = true;
              component.top = 50;
              component.left = 50;
              res = [component.name, component.bounds().insetBy(-50)];
            } else {
              res = [false];
            }
            res;
          `);

          if (!screenshotSize) break;

          await this.headlessSession.page.screenshot({
            path: (await worldFolder.join(componentName + '.png').ensureExistance()).url.replace('file://', ''),
            clip: screenshotSize,
            omitBackground: true
          });

          await this.headlessSession.runEval(`
            let component = window.__currentComponent__;
            component._origOwner.addMorph(component);
            component.position = component._origPos;
            component.hasFixedPosition = false;
          `);
        }
      } catch (err) {
        console.log('[ComponentsBrowser] Failed indexing ' + worldName);
        errorLog.push('[ComponentsBrowser] Failed indexing ' + worldName);
        continue;
      }
    }

    console.log('[ComponentsBrowser] Finished Indexing!');
    this.headlessSession.dispose();
    // write the index as a json into the root? Can be derived from the images...
  }

  get pluginId () { return 'ComponentsBrowser'; }

  handleRequest (req, res, next) {
    if (!req.url.startsWith('/subserver/ComponentsBrowser')) return next();
    if (req.url.startsWith('/subserver/ComponentsBrowser/refresh')) {
      // req = {}; req.url = "/subserver/ComponentsBrowser/refresh"
      const [_, worldName] = req.url.split('refresh/');
      return this.refresh(worldName && decodeURIComponent(worldName)).then(() => {
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end('Components Cached');
      }).catch(() => {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('Error');
      });
    }
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('ComponentsBrowser is running!');
  }
}
