var cordova_app = {
    // Application Constructor
    initialize: function() {
        this.bindEvents();
    },
    bindEvents: function() {
        document.addEventListener('deviceready', this.onDeviceReady, false);
    },
    onDeviceReady: function() {
        window.analytics.startTrackerWithId('UA-24934324-2');
        App.init();
        App.router.navigate('', {trigger: true});
    },
    receivedEvent: function(id) {
    }
};

cordova_app.initialize();