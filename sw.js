self.addEventListener('push', function(event){
  var data = {};
  try{ data = event.data ? event.data.json() : {}; } catch(e){}
  var title = data.title || 'Aclive Store';
  var options = {
    body: data.body || '',
    data: { url: data.url || '/admin.html' }
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', function(event){
  event.notification.close();
  var url = (event.notification.data && event.notification.data.url) || '/admin.html';
  event.waitUntil(clients.openWindow(url));
});
