import watchr from 'watchr';

watchr.open('static',    () => { console.log('fullPath') }, () => {});
watchr.open('src/views', () => { console.log('fullPath') }, () => {});

console.log('Watching');
