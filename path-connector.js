#!/usr/bin/env node

const fs = require('fs');

function connectPaths(geojson) {
  const features = geojson.features;
  const connectedPaths = [];
  const usedFeatures = new Set();
  
  // Find the first feature to start with
  let currentFeature = features[0];
  usedFeatures.add(0);
  
  // Start building the connected path
  let currentPath = [...currentFeature.geometry.coordinates];
  
  while (usedFeatures.size < features.length) {
    let foundConnection = false;
    
    // Look for a feature that connects to the current path
    for (let i = 0; i < features.length; i++) {
      if (usedFeatures.has(i)) continue;
      
      const feature = features[i];
      const coords = feature.geometry.coordinates;
      
      // Check if this feature connects to the end of current path
      const lastCoord = currentPath[currentPath.length - 1];
      const firstCoord = coords[0];
      const lastCoordOfFeature = coords[coords.length - 1];
      
      // Check if start connects to end of current path
      if (isClose(lastCoord, firstCoord)) {
        currentPath.push(...coords.slice(1)); // Add all coords except first (already connected)
        usedFeatures.add(i);
        foundConnection = true;
        break;
      }
      
      // Check if end connects to end of current path
      if (isClose(lastCoord, lastCoordOfFeature)) {
        currentPath.push(...coords.slice(0, -1).reverse()); // Add reversed coords except last
        usedFeatures.add(i);
        foundConnection = true;
        break;
      }
    }
    
    // If no connection found, start a new path segment
    if (!foundConnection) {
      // Save current path
      if (currentPath.length > 1) {
        connectedPaths.push([...currentPath]);
      }
      
      // Find next unused feature
      for (let i = 0; i < features.length; i++) {
        if (!usedFeatures.has(i)) {
          currentFeature = features[i];
          usedFeatures.add(i);
          currentPath = [...currentFeature.geometry.coordinates];
          break;
        }
      }
    }
  }
  
  // Add the last path
  if (currentPath.length > 1) {
    connectedPaths.push(currentPath);
  }
  
  // Create new GeoJSON with connected paths
  const connectedFeatures = connectedPaths.map((coords, index) => ({
    type: "Feature",
    properties: {
      id: index,
      connected: true
    },
    geometry: {
      type: "LineString",
      coordinates: coords
    }
  }));
  
  return {
    type: "FeatureCollection",
    features: connectedFeatures
  };
}

function isClose(coord1, coord2, tolerance = 0.0001) {
  const dx = coord1[0] - coord2[0];
  const dy = coord1[1] - coord2[1];
  return Math.sqrt(dx * dx + dy * dy) < tolerance;
}

// CLI usage
if (require.main === module) {
  const inputFile = process.argv[2];
  const outputFile = process.argv[3];
  
  if (!inputFile || !outputFile) {
    console.log('Usage: node path-connector.js input.geojson output.geojson');
    process.exit(1);
  }
  
  try {
    const data = JSON.parse(fs.readFileSync(inputFile, 'utf8'));
    const connected = connectPaths(data);
    fs.writeFileSync(outputFile, JSON.stringify(connected, null, 2));
    console.log(`Connected ${data.features.length} features into ${connected.features.length} paths`);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

module.exports = { connectPaths }; 