rects = []

function updatedrawer() {
    const data = window.rectdata;
    // if (rects.length != data)
    requestAnimationFrame(updatedrawer);
}

requestAnimationFrame(updatedrawer);