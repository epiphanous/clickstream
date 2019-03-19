import 'whatwg-fetch';
 
/**
* Simple request to api.ipify.org to get the ip address of the requesting client.
* @param  {type} cb {description}
* @return {type} {description}
*/
export default function GetIp(cb) {
  fetch('https://api.ipify.org').then(function(response){
    return response.text();
  }).then(function(ip) {
    cb(ip);
  });
}