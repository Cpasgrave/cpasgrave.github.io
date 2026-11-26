"use strict";

// Contours relevés sur les seize dessins d’origine, en coordonnées 256 × 256.
// Ils détachent le bois de l’ancienne ombre peinte dans chaque illustration.
const QuantikPions = (() => {
  // Quelques courbes longues suivent chaque exemplaire jusqu'à son point d'appui.
  const contours = {
    "miel-sphere-1": {
      base: 231, center: 129,
      outline: "M131 68C173 68 204 102 207 143S178 225 138 230C96 235 55 200 52 157S85 69 131 68Z"
    },
    "miel-sphere-2": {
      base: 229, center: 128,
      outline: "M125 67C167 64 202 99 206 139S180 223 138 229C94 235 54 201 50 159S78 72 125 67Z"
    },
    "sapin-sphere-1": {
      base: 226, center: 130,
      outline: "M127 72C167 70 198 103 201 144S175 221 135 226C95 230 59 196 56 156S84 74 127 72Z"
    },
    "sapin-sphere-2": {
      base: 227, center: 129,
      outline: "M124 75C165 72 197 102 201 143S176 222 136 226C96 231 59 199 56 158S83 78 124 75Z"
    },
    "miel-cylindre-1": {
      base: 228, center: 127,
      outline: "M57 98C56 78 91 59 125 58C160 56 197 70 198 94C198 123 194 166 193 194C192 211 160 228 129 228C97 230 61 214 60 196C59 166 57 126 57 98Z"
    },
    "miel-cylindre-2": {
      base: 230, center: 125,
      outline: "M55 94C55 73 89 57 123 57C156 55 197 69 198 94C199 119 194 167 192 195C191 214 158 229 127 230C96 231 55 215 55 196C54 164 55 120 55 94Z"
    },
    "sapin-cylindre-1": {
      base: 227, center: 128,
      outline: "M61 95C61 78 92 62 123 62C155 60 191 71 192 90C193 120 193 165 191 196C190 214 157 226 130 227C101 228 64 216 63 198C62 165 61 120 61 95Z"
    },
    "sapin-cylindre-2": {
      base: 229, center: 128,
      outline: "M63 94C62 75 95 61 127 61C157 60 191 73 192 92C193 119 192 166 191 198C190 214 159 229 129 229C99 230 66 217 65 199C63 168 64 120 63 94Z"
    },
    "miel-cone-1": {
      base: 232, center: 124,
      outline: "M124 55Q128 48 132 54C148 83 183 146 200 181Q206 193 197 202C182 219 148 232 122 232C94 233 63 220 51 203Q45 196 50 186C69 148 105 82 124 55Z"
    },
    "miel-cone-2": {
      base: 232, center: 124,
      outline: "M124 54Q128 49 132 55C151 86 183 149 199 184Q204 196 197 205C182 222 153 232 124 232C95 233 62 222 49 204Q44 196 49 185C68 148 104 83 124 54Z"
    },
    "sapin-cone-1": {
      base: 227, center: 128,
      outline: "M125 60Q128 54 131 60C147 91 179 153 199 190Q204 198 198 205C183 220 155 227 127 227C99 228 70 219 56 203Q52 197 56 188C72 154 107 91 125 60Z"
    },
    "sapin-cone-2": {
      base: 229, center: 128,
      outline: "M125 62Q128 56 132 62C150 95 181 156 199 191Q204 199 198 206C183 222 156 230 127 229C98 229 69 219 56 204Q53 197 57 189C74 151 107 91 125 62Z"
    },
    "miel-cube-1": {
      base: 236, center: 133,
      outline: "M113 54Q121 49 129 53Q163 66 200 80Q206 83 205 90Q205 130 202 169Q202 176 197 181Q172 208 145 232Q138 238 130 235Q90 220 49 202Q42 199 42 192Q40 153 41 113Q41 107 47 102Q79 77 113 54Z"
    },
    "miel-cube-2": {
      base: 236, center: 133,
      outline: "M115 53Q122 48 130 52Q165 65 202 79Q208 81 207 88Q205 133 202 176Q201 182 195 187Q168 211 145 232Q139 238 131 236Q88 218 50 205Q44 202 44 195Q41 153 38 108Q38 102 45 98Q78 75 115 53Z"
    },
    "sapin-cube-1": {
      base: 234, center: 134,
      outline: "M112 57Q118 53 125 56Q163 71 197 83Q202 85 202 91Q202 131 200 175Q200 181 195 186Q166 213 141 233Q136 237 130 233Q88 216 51 200Q47 198 47 192Q45 151 45 110Q45 105 50 101Q80 79 112 57Z"
    },
    "sapin-cube-2": {
      base: 235, center: 134,
      outline: "M113 54Q119 50 125 53Q163 68 197 81Q202 84 201 90Q202 132 201 176Q200 181 195 186Q167 212 141 233Q136 237 130 234Q89 217 49 201Q45 199 45 191Q43 151 43 110Q43 105 48 101Q82 77 113 54Z"
    }
  };
  // Inclinaison légère autour du pied, identique dans la réserve et sur le plateau.
  const coupes = {
    sphere: [[1.018,-.012,.018,.987],[.988,.014,-.020,1.018]],
    cylindre: [[1.008,.013,-.015,.991],[.992,-.015,.020,1.009]],
    cube: [[1.005,-.009,.010,.995],[.994,.006,-.014,1.006]],
    cone: [[.992,.008,-.017,1.008],[1.012,-.008,.020,.993]]
  };
  const ns = "http://www.w3.org/2000/svg";
  function element(tag, attributes) {
    const node = document.createElementNS(ns,tag);
    for (const [key,value] of Object.entries(attributes)) node.setAttribute(key,value);
    return node;
  }
  const defs = document.getElementById("encres-pions");
  for (const [name,{base,center,outline}] of Object.entries(contours)) {
    const [camp,forme,numero] = name.split("-");
    const [a,b,c,d] = coupes[forme][Number(numero)-1];
    const e = center*(1-a)-c*base, f = base*(1-d)-b*center;
    const id = "contour-"+name, clip = element("clipPath",{id:"taille-"+name});
    defs.append(element("path",{id,d:outline}));
    clip.append(element("use",{href:"#"+id})); defs.append(clip);
    const model = element("symbol",{id:"pion-"+name,viewBox:"0 0 256 256"});
    const shade = element("g",{fill:"black",filter:"url(#ombre-portee)"});
    shade.append(element("use",{href:"#"+id,opacity:".32",transform:
      "matrix(.94 .012 -.30 .20 "+(.06*center+.30*base+3)+" "+(.80*base-.012*center+4)+")"}));
    shade.append(element("ellipse",{cx:center+2,cy:base-4,rx:46,ry:7,opacity:".35"}));
    const body = element("g",{transform:"matrix("+[a,b,c,d,e,f].join(" ")+")"});
    const cut = element("g",{"clip-path":"url(#taille-"+name+")"});
    const raster = element("image",{href:"dessins/"+name+".webp",width:256,height:256});
    if (camp === "sapin") raster.setAttribute("filter","url(#patine-olive)");
    cut.append(raster);
    if (camp === "sapin") {
      cut.append(element("use",{href:"#"+id,fill:"none",stroke:"#2c321c","stroke-width":3.5,"stroke-linejoin":"round",opacity:".67"}));
    }
    body.append(cut); model.append(shade,body); defs.append(model);
  }
  function make(name) {
    const svg = element("svg",{viewBox:"0 0 256 256",class:"piece","aria-hidden":"true","data-drawing":name});
    svg.append(element("use",{href:"#pion-"+name}));
    return svg;
  }
  return {make};
})();
