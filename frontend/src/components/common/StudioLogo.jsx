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
    sm: 22,
    md: 28,
    lg: 34,
  };

  const fontSizes = {
    sm: "15px",
    md: "18px",
    lg: "22px",
  };

  const dotSizes = {
    sm: "5px",
    md: "6.5px",
    lg: "8px",
  };

  const dotMargins = {
    sm: "6px",
    md: "7px",
    lg: "8px",
  };

  return (
    <span
      className={`inline-flex items-center select-none whitespace-nowrap transition-opacity hover:opacity-90 ${className}`}
      style={{ gap: "9px" }}
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
      <span
        style={{
          fontFamily: "var(--serif, 'Source Serif 4', Georgia, serif)",
          fontSize: fontSizes[size] || fontSizes.md,
          fontWeight: 500,
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          color: dark ? "#FFFFFF" : "#050505",
          lineHeight: 1,
          display: "inline-flex",
          alignItems: "center",
        }}
      >
        {STUDIO_CONFIG.name}
        <span
          style={{
            display: "inline-block",
            width: dotSizes[size] || dotSizes.md,
            height: dotSizes[size] || dotSizes.md,
            borderRadius: "50%",
            backgroundColor: "#FED508",
            marginLeft: dotMargins[size] || dotMargins.md,
            flexShrink: 0,
            transform: "translateY(-1px)",
          }}
          aria-hidden="true"
        />
      </span>
    </span>
  );
};
