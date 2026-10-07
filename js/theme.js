
document.addEventListener('DOMContentLoaded',()=>{
const btn=document.getElementById('theme-toggle');
const light=document.getElementById('theme-toggle-light-icon');
const dark=document.getElementById('theme-toggle-dark-icon');

function render(){
 const isDark=(localStorage.getItem('color-theme')||'light')==='dark';
 document.documentElement.classList.toggle('dark',isDark);
 document.documentElement.classList.toggle('light',!isDark);
 if(light) light.classList.toggle('hidden',!isDark);
 if(dark) dark.classList.toggle('hidden',isDark);
}
render();

if(btn && !btn.dataset.fcThemeBound){
 btn.dataset.fcThemeBound='1';
 btn.addEventListener('click',()=>{
  const next=document.documentElement.classList.contains('dark')?'light':'dark';
  localStorage.setItem('color-theme',next);
  render();
 });
}
});
