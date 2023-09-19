import { HTMLMorph } from 'lively.morphic';
import { pt } from 'lively.graphics';
import { fun } from 'lively.lang';

/**
 * A VideoMorph, which is just an overlay on the HTML Video element
 * This is a subclass of the HTMLMorph, and so it inherits all of the HTMLMorph's
 * properties.
 * properties (should be in the constructor)
 *   - src: url for the video
 *   - codec: type of the video (mp4, ogg, etc)
 *   - controls: true/false to show not/show the controls (default false)
 *   - loop: true/false to play on a loop (default true)
 *   - autoplay: true/false to play on load (default true)
 *   - videoLayout:  one of 'autosize', 'autoaspect', 'none'. Default to autoaspect.
 *          If 'autosize', size the morph to the video's size.
 *          If 'autoaspect', resize to correct aspect ratio within current bounding box
 * methods:
 *    - startPlaying() -- start playing the video
 *    - stopPlaying() -- stop playing the video
 *    - rewind()  -- set the video counter to 0
 *
 * read-only properties:
 *     - videoDomElement -- the DOM element for the video
 *
 * Example:
 * // new VideoMorph({autoplay: false, src:'https://matt.engagelively.com/assets/ITF/New-creative-video-6-.mp4', videoLayout:'autosize'}).openInWorld()
 */

export class VideoMorph extends HTMLMorph {
  static get properties () {
    return {
      autoplay: {
        defaultValue: false,
        set (aBool) {
          this.setVideoProperty('autoplay', !!aBool);
        }
      },
      muted: {
        defaultValue: false
      },
      loop: {
        defaultValue: false,
        set (aBool) {
          this.setVideoProperty('loop', !!aBool);
        }
      },
      muted: { defaultValue: false },
      controls: {
        defaultValue: false,
        set (aBool) {
          this.setVideoProperty('controls', !!aBool);
        }
      },
      src: {
        defaultValue: 'https://matt.engagelively.com/assets/kaleidoscope-art-17141.mp4',
        set (srcURL) {
          this.setVideoProperty('src', srcURL);
          this.videoLoaded = false;
        }
      },
      codec: {
        defaultValue: 'video/mp4',
        set (videoType) {
          this.setVideoProperty('codec', videoType);
        }
      },
      videoLayout: {
        defaultValue: 'cover',
        type: 'Enum',
        values: ['cover', 'fill-vertical', 'fill-horizontal'],
        set (aLayoutStyle) {
          this.setProperty('videoLayout', aLayoutStyle);
          this.resetHTML();
        }
      }

    };
  }

  constructor (props) {
    this.constructorProps = props;
    super(props);
  }

  setVideoProperty (propertyName, value) {
    this.setProperty(propertyName, value);
    fun.debounceNamed('setVideoProperty' + this.id, 100, () => {
      this.resetHTML();
    })();
  }

  get domElementExtent () {
    return this.videoDomElement ? pt(this.videoDomElement.offsetWidth, this.videoDomElement.offsetHeight) : null;
  }

  init () {
    this.resetHTML();
    this.startPlaying();
  }

  get videoDomElement () {
    return this.domNode.querySelectorAll('video')[0];
  }

  rewind () {
    this.videoDomElement.currentTime = 0;
  }

  startPlaying () {
    this.videoDomElement.play();
  }

  pausePlaying () {
    this.videoDomElement.pause();
  }

  stopPlaying () {
    this.videoDomElement.pause();
    this.videoDomElement.currentTime = 0;
  }

  resetHTML () {
    const options = ` ${this.loop ? 'loop' : ''} ${this.controls ? 'controls' : ''} ${this.autoplay ? 'autoplay' : ''} ${this.muted ? 'muted' : ''}`;
    const widthPolicy = (this.videoLayout === 'cover' || this.videoLayout === 'fill-horizontal') ? '100%' : 'auto';
    const heightPolicy = (this.videoLayout === 'cover' || this.videoLayout === 'fill-vertical') ? '100%' : 'auto';
    this.html = `
  <video preload="auto" id="${this.videoId}" width="${widthPolicy}" height="${heightPolicy}" style="transform: translate(-50%, -50%); position: absolute; top: 50%; left: 50%; object-fit: cover;"${options} playsinline>
  <source src="${this.src}"  type="${this.codec}"/> 
${this.badBrowserMessage}
</video>
`;
  }

  remove () {
    this.stopPlaying();
    super.remove();
  }

  menuItems () {
    return $world.defaultMenuItems(this);
  }
}
