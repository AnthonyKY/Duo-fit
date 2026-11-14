// Strict iOS simulation injected into every test page:
// 1) 'change' never reaches text inputs/textareas (iOS doesn't blur them when a button is tapped)
// 2) native alert/confirm are recorded and confirm() returns false (as when iOS blocks dialogs)
// 3) anything the page's security policy (CSP) blocks is recorded too, so every suite fails if the policy breaks a feature
module.exports=`window.__nd=[];document.addEventListener('securitypolicyviolation',e=>{if(!window.__cspTest)window.__nd.push('csp:'+e.violatedDirective+' '+e.blockedURI)});window.alert=m=>{window.__nd.push('alert:'+m)};window.confirm=m=>{window.__nd.push('confirm:'+m);return false};
document.addEventListener('change',e=>{const el=e.target;if(el&&(el.tagName=='TEXTAREA'||(el.tagName=='INPUT'&&el.type=='text')))e.stopImmediatePropagation()},true);`;
