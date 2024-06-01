import{r as d}from"./index.NEDEFKed.js";var h={exports:{}},u={};/**
 * @license React
 * react-jsx-runtime.production.min.js
 *
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */var y=d,v=Symbol.for("react.element"),_=Symbol.for("react.fragment"),j=Object.prototype.hasOwnProperty,N=y.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED.ReactCurrentOwner,R={key:!0,ref:!0,__self:!0,__source:!0};function w(a,t,o){var e,i={},l=null,c=null;o!==void 0&&(l=""+o),t.key!==void 0&&(l=""+t.key),t.ref!==void 0&&(c=t.ref);for(e in t)j.call(t,e)&&!R.hasOwnProperty(e)&&(i[e]=t[e]);if(a&&a.defaultProps)for(e in t=a.defaultProps,t)i[e]===void 0&&(i[e]=t[e]);return{$$typeof:v,type:a,key:l,ref:c,props:i,_owner:N.current}}u.Fragment=_;u.jsx=w;u.jsxs=w;h.exports=u;var n=h.exports;function k(){const[a,t]=d.useState(""),[o,e]=d.useState(!1),[i,l]=d.useState(""),c=d.useRef(null);function s(){c.current?.value?t(c.current.value):t("")}async function x(){const r=window.location.origin.includes(":4321")?"http://localhost:3030":window.location.origin;try{const f=btoa(JSON.stringify({url:a,base:r})),p=await fetch(`${r}/verify/${f}`);if(!p.ok){const g=await p.json();alert(g);return}return await p.json()}catch(f){alert(`Try again in a few seconds: ${f.message}`)}return""}async function m(){e(!0),s();const r=await x();r.length&&(l(r),await navigator.clipboard.writeText(r).then(()=>alert("Copied, paste in Stremio!")).catch(f=>{e(!1)})),e(!1)}async function b(){try{e(!0),s();const r=await x();r.length&&(l(r),window.location.href=r,e(!1))}catch{e(!1)}}return n.jsxs("div",{className:"grid grid-cols-1 gap-1",children:[n.jsx("div",{className:"text-base",children:"A Letterboxd URL containing a list of posters (including any sorting!):"}),n.jsx("div",{children:n.jsx("input",{type:"text",placeholder:"https://letterboxd.com/almosteffective/watchlist",className:"w-full border border-black text-tailwind rounded text-xl px-2 py-1",ref:c,onPaste:s,onKeyDown:s,onKeyUp:s,onBlur:s,onFocus:s})}),n.jsxs("div",{className:"flex gap-1",children:[n.jsx("button",{className:"grow border border-white bg-white uppercase text-tailwind text-lg p-2 rounded font-bold hover:bg-tailwind hover:text-white hover:underline",onClick:b,disabled:o,children:o===!1?"Install":"..."}),n.jsx("button",{className:"grow border border-transparent hover:border-white bg-tailwind uppercase text-white text-lg p-2 rounded font-normal",onClick:m,disabled:o,children:o===!1?"Copy":"..."})]}),n.jsx("div",{className:"hidden",children:i})]})}export{k as default};
