var rects = []
var data = null;

const rectexpansion = 20;

const rectcontainer = document.getElementById('rectcontainer');
function generaterect(data) {
    const rect = document.createElement('div');
    rect.className = 'rect';
    rect.style.setProperty('--borcorcol', data.color)

    const title = document.createElement('span');
    title.textContent = data.title;
    title.className='recttitle';

    rect.append(title);
    rectcontainer.append(rect);

    return rect
}

function syncElement(canvas, element, x, y, width, height) {
  const rect = canvas.getBoundingClientRect();

  const scaleX = rect.width / canvas.width;
  const scaleY = rect.height / canvas.height;

  Object.assign(element.style, {
    position: "fixed",
    left: `${rect.left + x * scaleX}px`,
    bottom: `${window.innerHeight - rect.bottom + y * scaleY}px`,
    width: `${width * scaleX}px`,
    height: `${height * scaleY}px`
  });
}

// i woulda spent far too long on this tbh
function rotatedBounds(center, size, theta) {
  const [cx, cy] = center;
  const [w, h] = size;

  const corners = [
    [-w / 2, -h / 2],
    [ w / 2, -h / 2],
    [ w / 2,  h / 2],
    [-w / 2,  h / 2]
  ].map(p => {
    const [x, y] = rotate(p, theta);
    return [x + cx, y + cy];
  });

  const xs = corners.map(p => p[0]);
  const ys = corners.map(p => p[1]);

  const minX = Math.min(...xs) - rectexpansion;
  const maxX = Math.max(...xs) + rectexpansion;
  const minY = Math.min(...ys) - rectexpansion;
  const maxY = Math.max(...ys) + rectexpansion;

  return {
    leftbottom: [minX, minY],
    size: [maxX - minX, maxY - minY]
  };
}

function updaterect(r, livedata) {
    const bounds = rotatedBounds([livedata[1], livedata[2]], [livedata[3], livedata[4]], livedata[5])

    syncElement(canvas, r, bounds.leftbottom[0], bounds.leftbottom[1], bounds.size[0], bounds.size[1]);
}

function updatedrawer() {
    data = window.rectdata;

    for (let r = 0; r < rects.length; r++)
        updaterect(rects[r], data[r]);

    requestAnimationFrame(updatedrawer);
}

for (let i = 0; i < allrects.length; i++) {
    let newrect = generaterect(allrects[i]);
    rects.push(newrect);
} 
requestAnimationFrame(updatedrawer);