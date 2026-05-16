{ pkgs }: {
  deps = [
    pkgs.bun
    pkgs.yt-dlp
    pkgs.ffmpeg
    pkgs.chromium

    # Fonts so Chromium renders text in the screenshots
    pkgs.fontconfig
    pkgs.dejavu_fonts
    pkgs.noto-fonts
    pkgs.noto-fonts-emoji

    # Chromium runtime libraries
    pkgs.glib
    pkgs.nss
    pkgs.nspr
    pkgs.atk
    pkgs.at-spi2-atk
    pkgs.at-spi2-core
    pkgs.cups
    pkgs.dbus
    pkgs.libdrm
    pkgs.gtk3
    pkgs.pango
    pkgs.cairo
    pkgs.expat
    pkgs.libxkbcommon
    pkgs.mesa
    pkgs.alsa-lib
    pkgs.xorg.libX11
    pkgs.xorg.libXcomposite
    pkgs.xorg.libXcursor
    pkgs.xorg.libXdamage
    pkgs.xorg.libXext
    pkgs.xorg.libXfixes
    pkgs.xorg.libXi
    pkgs.xorg.libXrandr
    pkgs.xorg.libXrender
    pkgs.xorg.libXtst
    pkgs.xorg.libxcb
  ];

  env = {
    # Use the system Chromium instead of Puppeteer's bundled download.
    PUPPETEER_EXECUTABLE_PATH = "${pkgs.chromium}/bin/chromium";
    PUPPETEER_SKIP_DOWNLOAD = "1";
  };
}
