class FlightDispatcher < Formula
  desc "Zero-install CLI that auto-generates .github/copilot-instructions.md"
  homepage "https://github.com/caglarorhan/flight-dispatcher"
  version "1.1.0"
  license "MIT"

  on_macos do
    if Hardware::CPU.arm?
      url "https://github.com/caglarorhan/flight-dispatcher/releases/download/v1.1.0/flight-dispatcher-v1.1.0-macos-arm64"
      sha256 "PLACEHOLDER_ARM64_SHA256"

      def install
        bin.install "flight-dispatcher-#{version}-macos-arm64" => "flight-dispatcher"
      end
    else
      url "https://github.com/caglarorhan/flight-dispatcher/releases/download/v1.1.0/flight-dispatcher-v1.1.0-macos-x64"
      sha256 "PLACEHOLDER_X64_SHA256"

      def install
        bin.install "flight-dispatcher-#{version}-macos-x64" => "flight-dispatcher"
      end
    end
  end

  on_linux do
    url "https://github.com/caglarorhan/flight-dispatcher/releases/download/v1.1.0/flight-dispatcher-v1.1.0-linux-x64"
    sha256 "PLACEHOLDER_LINUX_SHA256"

    def install
      bin.install "flight-dispatcher-#{version}-linux-x64" => "flight-dispatcher"
    end
  end

  test do
    system "#{bin}/flight-dispatcher", "--help"
  end
end
