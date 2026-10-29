"use client";

import React from "react";
import { STUDIO_CONFIG } from "@/config/detailsConfig";

export const StudioLogo = ({
  dark = false,
  size = "md",
  showFlower = true,
  className = "",
}) => {
  const flowerSizes = {
    sm: 24,
    md: 30,
    lg: 38,
  };

  const logoHeights = {
    sm: 18,
    md: 22,
    lg: 28,
  };

  const logoSrc = dark ? "/images/logo-white.svg" : "/images/logo.svg";

  return (
    <span
      className={`inline-flex items-center select-none whitespace-nowrap transition-opacity hover:opacity-90 ${className}`}
      style={{ gap: "10px" }}
    >
      {showFlower && (
        <img
          src="/images/frangipani-flower.svg"
          alt=""
          aria-hidden="true"
          width={flowerSizes[size] || flowerSizes.md}
          height={flowerSizes[size] || flowerSizes.md}
          style={{
            width: `${flowerSizes[size] || flowerSizes.md}px`,
            height: `${flowerSizes[size] || flowerSizes.md}px`,
            objectFit: "contain",
            flexShrink: 0,
          }}
        />
      )}
      <img
        src={logoSrc}
        alt={STUDIO_CONFIG.name}
        height={logoHeights[size] || logoHeights.md}
        style={{
          height: `${logoHeights[size] || logoHeights.md}px`,
          width: "auto",
          maxWidth: "100%",
          objectFit: "contain",
          display: "block",
        }}
      />
    </span>
  );
};
