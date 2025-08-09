#!/usr/bin/env node

const fs = require('fs');

function connectMazePaths(geojson) {
  const features = geojson.features;
  const connectedPaths = [];
  const usedFeatures = new Set();
  
  // Group features by their endpoints for better connection detection
  const endpointMap = new Map();
  
  // Build endpoint map
  features.forEach((feature, index) => {
    const coords = feature.geometry.coordinates;
    const start = coords[0];
    const end = coords[coords.length - 1];
    
    const startKey = `${start[0].toFixed(6)},${start[1].toFixed(6)}`;
    const endKey = `${end[0].toFixed(6)},${end[1].toFixed(6)}`;
    
    if (!endpointMap.has(startKey)) endpointMap.set(startKey, []);
    if (!endpointMap.has(endKey)) endpointMap.set(endKey, []);
    
    endpointMap.get(startKey).push({ index, isStart: true });
    endpointMap.get(endKey).push({ index, isStart: false });
  });
  
  // Find connected components
  while (usedFeatures.size < features.length) {
    // Find next unused feature
    let startFeature = null;
    for (let i = 0; i < features.length; i++) {
      if (!usedFeatures.has(i)) {
        startFeature = features[i];
        break;
      }
    }
    
    if (!startFeature) break;
    
    // Build connected path from this feature
    const connectedPath = buildConnectedPath(startFeature, features, usedFeatures, endpointMap);
    if (connectedPath.length > 1) {
      connectedPaths.push(connectedPath);
    }
  }
  
  // Create new GeoJSON
  const connectedFeatures = connectedPaths.map((coords, index) => ({
    type: "Feature",
    properties: {
      id: index,
      connected: true,
      length: coords.length
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

function buildConnectedPath(startFeature, features, usedFeatures, endpointMap) {
  const path = [...startFeature.geometry.coordinates];
  usedFeatures.add(features.indexOf(startFeature));
  
  let currentEnd = path[path.length - 1];
  let currentStart = path[0];
  
  let changed = true;
  while (changed) {
    changed = false;
    
    // Try to connect to the end
    const endKey = `${currentEnd[0].toFixed(6)},${currentEnd[1].toFixed(6)}`;
    const endConnections = endpointMap.get(endKey) || [];
    
    for (const connection of endConnections) {
      if (usedFeatures.has(connection.index)) continue;
      
      const feature = features[connection.index];
      const coords = feature.geometry.coordinates;
      
      if (connection.isStart) {
        // Feature starts where current path ends
        path.push(...coords.slice(1));
        currentEnd = coords[coords.length - 1];
      } else {
        // Feature ends where current path ends, so reverse it
        path.push(...coords.slice(0, -1).reverse());
        currentEnd = coords[0];
      }
      
      usedFeatures.add(connection.index);
      changed = true;
      break;
    }
    
    // Try to connect to the start
    const startKey = `${currentStart[0].toFixed(6)},${currentStart[1].toFixed(6)}`;
    const startConnections = endpointMap.get(startKey) || [];
    
    for (const connection of startConnections) {
      if (usedFeatures.has(connection.index)) continue;
      
      const feature = features[connection.index];
      const coords = feature.geometry.coordinates;
      
      if (connection.isStart) {
        // Feature starts where current path starts, so reverse it
        path.unshift(...coords.slice(1).reverse());
        currentStart = coords[coords.length - 1];
      } else {
        // Feature ends where current path starts
        path.unshift(...coords.slice(0, -1));
        currentStart = coords[0];
      }
      
      usedFeatures.add(connection.index);
      changed = true;
      break;
    }
  }
  
  return path;
}

// CLI usage
if (require.main === module) {
  const inputFile = process.argv[2];
  const outputFile = process.argv[3];
  
  if (!inputFile || !outputFile) {
    console.log('Usage: node maze-connector.js input.geojson output.geojson');
    process.exit(1);
  }
  
  try {
    const data = JSON.parse(fs.readFileSync(inputFile, 'utf8'));
    const connected = connectMazePaths(data);
    fs.writeFileSync(outputFile, JSON.stringify(connected, null, 2));
    console.log(`Connected ${data.features.length} features into ${connected.features.length} paths`);
    console.log(`Total coordinates: ${connected.features.reduce((sum, f) => sum + f.geometry.coordinates.length, 0)}`);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

module.exports = { connectMazePaths }; 