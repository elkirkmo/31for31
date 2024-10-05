<section>
  <video
    loop
    src="https://video.wixstatic.com/video/d47472_58cce06729c54ccb935886c4b3647274/1080p/mp4/file.mp4"
    autoplay
    muted
    playsinline
  ></video>
</section>

<style>
  /**
    Shamelessly borrowed from https://codepen.io/alexaluthor/pen/bGBjRdp
    */
  section {
    height: 100vh;
    background: #000;
    position: fixed;
    top: 0;
    z-index: -1;
  }
  section:before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    background-image: linear-gradient(
      to top,
      rgba(55, 106, 44, 0.5),
      rgba(122, 171, 122, 0.5),
      rgba(229, 237, 229, 0.5),
      rgba(153, 153, 153, 0.5),
      rgba(153, 153, 153, 0.5),
      rgba(255, 255, 255, 0)
    );
    mix-blend-mode: color;
    pointer-events: none;
  }
  video {
    object-fit: cover;
    height: 100%;
    width: 100%;
  }
</style>
