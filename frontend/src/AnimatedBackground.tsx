import { useState, useEffect } from "react";

// Inner component that generates random positions on mount
function DOKStoryAnimation() {
  // Generate random positions once on mount
  // Height: between 15% and 95% (avoiding top 15% and bottom 5%)
  // Width: left third (5-28%), middle third (38-62%), right third (72-95%)
  const [positions] = useState(() => {
    // Blue newspaper: either top (5-30%) or bottom (80-95%)
    const blueInTop = Math.random() > 0.5;
    const blue = {
      x: 38 + Math.random() * 24, // 38% to 62%
      y: blueInTop
        ? 5 + Math.random() * 25   // top zone: 5% to 30%
        : 80 + Math.random() * 15, // bottom zone: 80% to 95%
    };

    // Vertical thirds for green lightbulbs
    const verticalThirds = {
      top: () => 15 + Math.random() * 25,    // 15% - 40%
      middle: () => 40 + Math.random() * 25, // 40% - 65%
      bottom: () => 65 + Math.random() * 30, // 65% - 95%
    };
    const thirdKeys = ['top', 'middle', 'bottom'] as const;

    // 50% chance of having 2 lightbulbs
    const hasTwoGreens = Math.random() > 0.5;

    // Pick first lightbulb's third randomly
    const firstThirdIndex = Math.floor(Math.random() * 3);
    const firstThird = thirdKeys[firstThirdIndex];

    // Build greens array
    const greens: { x: number; y: number; path?: string }[] = [
      {
        x: 72 + Math.random() * 23, // 72% to 95%
        y: verticalThirds[firstThird](),
      },
    ];

    if (hasTwoGreens) {
      // Pick second third from remaining options
      const remainingThirds = thirdKeys.filter((_, i) => i !== firstThirdIndex);
      const secondThird = remainingThirds[Math.floor(Math.random() * 2)];
      greens.push({
        x: 72 + Math.random() * 23,
        y: verticalThirds[secondThird](),
      });
    }

    const amber = {
      x: 5 + Math.random() * 23, // 5% to 28%
      y: 15 + Math.random() * 80,
    };

    // Chance of a second newspaper appearing after connections finish

    const hasSecondBlue = Math.random() < 0.43;
    const secondBlue = hasSecondBlue
      ? {
          x: 38 + Math.random() * 24, // 38% to 62%
          y: Math.random() > 0.5
            ? 5 + Math.random() * 25   // top zone: 5% to 30%
            : 80 + Math.random() * 15, // bottom zone: 80% to 95%
        }
      : null;

    // Generate curved paths with random control points
    // Control point is perpendicular to the line midpoint, offset by random amount
    const getCurvedPath = (x1: number, y1: number, x2: number, y2: number) => {
      const midX = (x1 + x2) / 2;
      const midY = (y1 + y2) / 2;
      // Perpendicular offset: rotate 90 degrees
      const dx = x2 - x1;
      const dy = y2 - y1;
      // Random curve intensity: -20 to +20 (negative = curve one way, positive = other)
      const curveAmount = (Math.random() - 0.5) * 40;
      // Normalize and apply perpendicular offset
      const len = Math.sqrt(dx * dx + dy * dy);
      const controlX = midX + (-dy / len) * curveAmount;
      const controlY = midY + (dx / len) * curveAmount;
      return `M ${x1} ${y1} Q ${controlX} ${controlY} ${x2} ${y2}`;
    };

    // Add paths to greens
    greens.forEach((g) => {
      g.path = getCurvedPath(blue.x, blue.y, g.x, g.y);
    });

    return {
      blue,
      greens,
      amber,
      pathToAmber: getCurvedPath(blue.x, blue.y, amber.x, amber.y),
      secondBlue,
      pathFromAmberToSecondBlue: secondBlue
        ? getCurvedPath(amber.x, amber.y, secondBlue.x, secondBlue.y)
        : null,
    };
  });

  return (
    <div className={`dok-story ${positions.secondBlue ? 'dok-story-extended' : ''}`}>
        {/* Blue blob - Newspaper (Facts/DOK2) - Center, appears first */}
        <div
          className="dok-blob dok-blob-blue"
          style={{ left: `${positions.blue.x}%`, top: `${positions.blue.y}%` }}
        >
          <svg viewBox="0 0 24 24" fill="currentColor" width="24" height="24">
            <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z"/>
          </svg>
        </div>

        {/* Green blobs - Lightbulbs (Insights/DOK3) - Right, appears second */}
        {positions.greens.map((green, index) => (
          <div
            key={index}
            className={`dok-blob dok-blob-green ${index === 1 ? 'dok-blob-green-2' : ''}`}
            style={{ left: `${green.x}%`, top: `${green.y}%` }}
          >
            <svg viewBox="0 0 24 24" fill="currentColor" width="24" height="24">
              <path d="M9 21c0 .55.45 1 1 1h4c.55 0 1-.45 1-1v-1H9v1zm3-19C8.14 2 5 5.14 5 9c0 2.38 1.19 4.47 3 5.74V17c0 .55.45 1 1 1h6c.55 0 1-.45 1-1v-2.26c1.81-1.27 3-3.36 3-5.74 0-3.86-3.14-7-7-7z"/>
            </svg>
          </div>
        ))}

        {/* Amber blob - Star (SPOVs/DOK4) - Left, appears third */}
        <div
          className="dok-blob dok-blob-amber"
          style={{ left: `${positions.amber.x}%`, top: `${positions.amber.y}%` }}
        >
          <svg viewBox="0 0 24 24" fill="currentColor" width="24" height="24">
            <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/>
          </svg>
        </div>

        {/* Second Blue blob - Newspaper (new fact from SPOV) - appears after connections */}
        {positions.secondBlue && (
          <div
            className="dok-blob dok-blob-blue dok-blob-blue-2"
            style={{ left: `${positions.secondBlue.x}%`, top: `${positions.secondBlue.y}%` }}
          >
            <svg viewBox="0 0 24 24" fill="currentColor" width="24" height="24">
              <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z"/>
            </svg>
          </div>
        )}

      {/* Connection curves - appear after blobs */}
      <svg className="dok-connections" viewBox="0 0 100 100" preserveAspectRatio="none">
        {/* Curved paths from blue (center) to greens (right) */}
        {positions.greens.map((green, index) => (
          <path
            key={index}
            className={`dok-connection-line dok-line-green ${index === 1 ? 'dok-line-green-2' : ''}`}
            d={green.path}
          />
        ))}
        {/* Curved path from blue (center) to amber (left) */}
        <path
          className="dok-connection-line dok-line-amber"
          d={positions.pathToAmber}
        />
        {/* Curved path from amber to second blue (new fact from SPOV) */}
        {positions.pathFromAmberToSecondBlue && (
          <path
            className="dok-connection-line dok-line-amber-to-blue"
            d={positions.pathFromAmberToSecondBlue}
          />
        )}
      </svg>
    </div>
  );
}

// Wrapper that cycles the animation infinitely
export default function AnimatedBackground() {
  const [cycle, setCycle] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setCycle((c) => c + 1);
    }, 8500);

    return () => clearInterval(timer);
  }, []);

  return (
    <div className="neural-bg">
      {/* Key change forces remount → new random positions */}
      <DOKStoryAnimation key={cycle} />
    </div>
  );
}
