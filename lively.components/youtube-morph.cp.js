import { component, ViewModel, HTMLMorph } from 'lively.morphic';

class YouTubeEmbedViewModel extends ViewModel {
  static get properties () {
    return {
      videoURL: {}
    };
  }

  viewDidLoad () {
    this.view.html = `<iframe width="${this.view.width}" height="${this.view.height}" src="${this.videoURL}" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>`;
  }
}

export const YouTubeEmbed = component({
  type: HTMLMorph,
  defaultViewModel: YouTubeEmbedViewModel
});
