"use strict";

// Coordinates in the illustration's 1000 by 750 drawing space. Both the
// carved regions and the playable cells follow the same receding surface.
const QuantikTable = (() => {
  const ns = "http://www.w3.org/2000/svg";
  function project(u, v) {
    const left = 133 - 70*v, right = 853 + 68*v;
    return [left+(right-left)*u, 100+495*v];
  }
  function path(container, d, className) {
    const line = document.createElementNS(ns,"path");
    line.setAttribute("d",d); line.setAttribute("class",className); container.append(line);
  }
  function carveRegions(svg) {
    for (let i = 0; i < 4; i++) {
      const left = (i%2)/2 + .006, top = Math.floor(i/2)/2 + .006;
      const right = left+.486, bottom = top+.485;
      const p = (u,v) => project(u,v).map(n => n.toFixed(1)).join(" ");
      const d = "M "+p(left+.035,top)+" Q "+p(left+.25,top-.007)+" "+p(right-.025,top)+
        " Q "+p(right,top)+" "+p(right,top+.035)+" L "+p(right,bottom-.03)+
        " Q "+p(right,bottom)+" "+p(right-.03,bottom)+" Q "+p(left+.22,bottom-.004)+" "+p(left+.03,bottom)+
        " Q "+p(left,bottom)+" "+p(left,bottom-.03)+" L "+p(left,top+.035)+" Q "+p(left,top)+" "+p(left+.035,top)+" Z";
      path(svg,d,"region-rim"); path(svg,d,"region-wash r"+i);
    }
  }
  const outlines = [
    "M9 52C8 29 37 12 73 12c38-1 66 14 67 34 2 22-26 40-65 41C38 89 11 75 9 52Z",
    "M10 50C10 29 40 12 77 13c36 0 62 14 62 36-1 21-30 38-66 38C36 87 9 72 10 50Z",
    "M10 53C8 32 36 14 72 12c39-2 66 14 68 35 3 22-27 39-65 40C40 89 13 76 10 53Z",
    "M11 49C12 28 41 13 77 14c36-1 63 14 62 35-1 23-31 37-65 38C38 88 10 72 11 49Z"
  ];
  function makeCell(index) {
    const col = index%4, row = Math.floor(index/4);
    const v = (row+.5)/4, [x,y] = project((col+.5)/4,v);
    const width = (project(1,v)[0]-project(0,v)[0])/4;
    const button = document.createElement("button");
    button.type = "button"; button.className = "cell"; button.dataset.cell = index;
    button.style.left = x/10+"%"; button.style.top = y/7.5+"%";
    button.style.width = width/10+"%"; button.style.height = (495/4)/7.5+"%";
    button.style.zIndex = row+1;
    const well = document.createElementNS(ns,"svg");
    well.setAttribute("viewBox","0 0 150 100"); well.setAttribute("preserveAspectRatio","none");
    well.setAttribute("aria-hidden","true"); well.classList.add("well");
    const d = outlines[(col+row*3)%4];
    path(well,d,"well-lip"); path(well,d,"well-wash");
    path(well,"M14 49Q16 29 45 20M107 79q14-5 22-14","toolmark");
    const token = document.createElement("span"); token.className = "token";
    button.append(well,token); return button;
  }
  return {carveRegions,makeCell};
})();
