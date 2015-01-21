var bitmap = ['bmp','gif','jpe','jpeg','jpg','png'];
var download = ['prg','exe','bat','dat','zip','rar','r00','r01','r02','r03','r04','r05','r06','r07','r08','r09','ace','mp3','mus','it','xm','avi','mpg','mpeg','mpe','mkv','mov','fla','flv','mp4'];

var body_class = ['index','year','pack','artwork'];

var mc;

var App = {};

App.init = function(){

    App.name = 'Artpacks.org ANSI & ASCII Art Archive';
    $('.title').text(App.name);

    App.touch = ('ontouchstart' in window) || window.DocumentTouch && document instanceof DocumentTouch;

    this.homeView = new App.HomeView();
    this.yearView = new App.YearView();
    this.packView = new App.PackView();
    this.artView  = new App.ArtView();

    this.router   = new App.Router();

    Backbone.history.start({pushState:true});

    $(document).on('click', 'a:not([data-bypass])', function (evt) {

        var href = $(this).attr('href');
        var protocol = this.protocol + '//';

        if (href.slice(protocol.length) !== protocol) {
            evt.preventDefault();
            App.router.navigate(href, true);
        }
    });

}



App.Router = Backbone.Router.extend({

    currentView: App.homeView,

    routes: {
        ''                  : 'showHome',
        ':year'             : 'showYear',
        ':year/:pack'       : 'showPack',
        ':year/:pack/:art'  : 'showArt',
    },

    clearCurrent: function(){
        if(this.currentView){
            this.currentView.$el.html('');
            this.currentView.remove();
        }
    },

    showHome: function() {


        //$('#content').fadeOut(function(){

            App.router.clearCurrent();

            $.ajax({
                dataType: "json",
                url: 'http://api.artpacks.org/v0/years',
                success: function(data) {

                    $('body').removeClass(body_class.join(' ')).addClass('index');

                    document.title = App.name;
                    breadcrumbs(data);
                    window.analytics.trackView('index',
                        function(success){ console.log(success); },
                        function(error){ console.log(error); }
                    );
                    App.homeView.render(data);

                    $('#content').html(App.homeView.$el);
                    App.router.currentView = App.homeView;
                    //$('#content').fadeIn();

                }
            });

        //});

    },

    showYear: function(year) {

        //$('#content').fadeOut(function(){

            App.router.clearCurrent();

            $.ajax({
                dataType: "json",
                url: 'http://api.artpacks.org/v0/'+year,
                success: function(data) {

                    $('body').removeClass(body_class.join(' ')).addClass('year');

                    document.title = 'Artpacks.org\\'+year+'\\';
                    breadcrumbs(data, year);
                    window.analytics.trackView(year,
                        function(success){ console.log(success); },
                        function(error){ console.log(error); }
                    );
                    App.yearView.render(data);

                    $('#content').html(App.yearView.$el);
                    App.router.currentView = App.yearView;
                    //$('#content').fadeIn();

                }
            });

            if(mc) { mc.destroy(); }

        //});

    },

    showPack: function(year, pack) {

        //$('#content').fadeOut(function(){

            App.router.clearCurrent();

            $.ajax({
                dataType: "json",
                url: 'http://api.artpacks.org/v0/'+year+'/'+pack,
                success: function(data) {

                    $('body').removeClass(body_class.join(' ')).addClass('pack');

                    document.title = 'Artpacks.org\\'+year+'\\'+pack+'\\';
                    breadcrumbs(data, year, pack);
                    window.analytics.trackView(year+'/'+pack,
                        function(success){ console.log(success); },
                        function(error){ console.log(error); }
                    );
                    App.packView.render(data);

                    $('#content').html(App.packView.$el);
                    App.router.currentView = App.packView;
                    //$('#content').fadeIn();

                }
            });

        //});

    },

    showArt: function(year, pack, art) {

        //$('#content').fadeOut(function(){

            App.router.clearCurrent();

            $.ajax({
                dataType: "json",
                url: 'http://api.artpacks.org/v0/'+year+'/'+pack+'/'+art,
                success: function(data) {

                    $('body').removeClass(body_class.join(' ')).addClass('artwork');

                    document.title = 'Artpacks.org\\'+year+'\\'+pack+'\\'+art;
                    breadcrumbs(data, year, pack, art);
                    window.analytics.trackView(year+'/'+pack+'/'+art,
                        function(success){ console.log(success); },
                        function(error){ console.log(error); }
                    );
                    App.artView.render(data, year, pack, art);

                    $('#content').html(App.artView.$el);
                    App.router.currentView = App.artView;
                    //$('#content').fadeIn();

                }
            });

        //});

    },

});



App.HomeView = Backbone.View.extend({

    tagName: 'div',
    className: 'index',

    render: function(data) {

        this.delegateEvents();

        var tpl = $('.homeTemplate').text();
        var html = _.template(tpl, data);

        this.$el.html(html);

    }

});



App.YearView = Backbone.View.extend({

    tagName: 'div',
    className: 'year',

    render: function(data) {

        this.delegateEvents();

        var tpl = $('.yearTemplate').text();
        var html = _.template(tpl, data);

        this.$el.html(html);

    }

});



App.PackView = Backbone.View.extend({

    tagName: 'div',
    className: 'pack',

    render: function(data) {

        this.delegateEvents();

        var tpl = $('.packTemplate').text();
        var html = _.template(tpl, data);

        this.$el.html(html);

    }

});



App.ArtView = Backbone.View.extend({

    tagName: 'div',
    id:'artwork',
    className:'fit-width',

    render: function(data, year, pack, art) {

        this.delegateEvents();
    
        var tpl = $('.artworkTemplate').text();
        var html = _.template(tpl, data);

        this.$el.html(html);

        /* Display Art
        -------------------------------------------------- */
        var ext = data.ext;
        var artwork = 'http://files.artpacks.org'+data.filepath;

        var display_settings = { "font":"80x25", "bits": "8", "thumbnail": 0 };
        if(ext.toLowerCase() == 'txt') {
            var display_settings = { "font":"topaz+", "bits": "8", "thumbnail": 0 };
        }
        if(art == 'avg-250wide.bin'){
            display_settings.columns = 250;
        }

        localStorage.setItem('cursor_artwork', art);

        if($.inArray(ext.toLowerCase(), bitmap) != -1) {
          setTimeout(function(){ $('#artwork').append('<img class="fit-width" src="'+artwork+'" />'); },1);
          console.log(artwork);
        } else if (ext.toLowerCase() == 'rip') {

          Ripscrip.render(
            'http://files.artpacks.org/'+year+'/'+pack+'/'+encodeURIComponent(art),
            function(canvas) { $('#artwork').append(canvas); }
          );

        } else if ($.inArray(ext.toLowerCase(), download) != -1) {
          setTimeout(function(){
              $('#artwork').append('<p class="text-center"><i class="fa fa-frown-o"></i><br />Sorry!<br /><br />Artpacks.org can\'t display '+ext+' files.</p>');
          },1);
        } else {
            display_settings.thumbnail = 1;
            AnsiLove.splitRender(artwork, function (canvases, sauce) {
                if (typeof sauce !== 'undefined') {
                    if (typeof sauce.tInfoS !== 'undefined') {
                        if(sauce.tInfoS.toLowerCase().indexOf('topaz') > -1) { display_settings.font = 'topaz+'; }
                    }
                }
            }, 25, display_settings);

            display_settings.thumbnail = 0;

            AnsiLove.splitRender(artwork, function (canvases, sauce) {
              canvases.forEach(function (canvas) {
                canvas.style.verticalAlign = "bottom";
                $('#artwork').append(canvas);
              });
            }, 25, display_settings);
        }

        if(mc) { mc.off("swipeleft swiperight tap press"); }

        content_area = document.getElementById('body');
        mc = new Hammer(content_area);

        mc.on("swipeleft swiperight tap press", function(ev) {
            if(ev.type == 'swipeleft') {
                App.router.navigate(data.nav.next, {trigger: true});
                mc.destroy();
            } else if(ev.type == 'swiperight') {
                App.router.navigate(data.nav.prev, {trigger: true});
                mc.destroy();
            } else if(ev.type == 'press') {
                $('#long_press').modal({ keyboard:false, backdrop:'static' });
            }
        });

        /* Keyboard Controls
        -------------------------------------------------- */
        Mousetrap.bind('left', function() {
            if($('body').hasClass('artwork')) {
                App.router.navigate(data.nav.prev, {trigger: true});
            }
        });
        Mousetrap.bind('right', function() {
            if($('body').hasClass('artwork')) {
                App.router.navigate(data.nav.next, {trigger: true});
            }
        });
        Mousetrap.bind('esc', function() {
            if($('body').hasClass('artwork')) {
                App.router.navigate('/'+year+'/'+pack, {trigger: true});
            }
        });

        $(document).on('click', '#display_settings button[type=submit]', function(e) {

            e.preventDefault();
            display_settings.font = $('select[name=font]').val();
            display_settings.bits = $('select[name=bit_width]').val();
            display_settings.icecolors = $('select[name=colors]').val();
            $('#artwork').html('');
            if($.inArray(ext, bitmap) != -1) {
              $('#artwork').append('<img class="fit-width" src="'+art+'" />');
            } else if ($.inArray(ext, download) != -1) {
              $('#artwork').append('<p class="text-center"><i class="fa fa-frown-o"></i><br />Sorry!<br /><br />Artpacks.org can\'t display '+ext+' files.</p>');
            } else {
              AnsiLove.splitRender(artwork, function (canvases, sauce) {
                canvases.forEach(function (canvas) {
                  canvas.style.verticalAlign = "bottom";
                  $('#artwork').append(canvas);
                });
              }, 25, display_settings);
            }
            $('#long_press').modal('hide');

        });

    }

});


function breadcrumbs(data, year, pack, art) {

    if(art) {
        $('.navbar-header').html('<span class="navbar-brand"><a href="/">A:</a>\\<a href="/'+year+'">'+data.breadcrumbs.year+'</a>\\<a href="/'+year+'/'+pack+'">'+data.breadcrumbs.pack+'</a>\\<a href="/'+year+'/'+pack+'/'+art+'">'+data.breadcrumbs.art+'</a></span>');
    } else if(pack) {
        $('.navbar-header').html('<span class="navbar-brand"><a href="/">A:</a>\\<a href="/'+year+'">'+data.breadcrumbs.year+'</a>\\<a href="/'+year+'/'+pack+'">'+data.breadcrumbs.pack+'</a>\\</span>');
    } else if(year) {
        $('.navbar-header').html('<span class="navbar-brand"><a href="/">A:</a>\\<a href="/'+year+'">'+data.breadcrumbs.year+'</a>\\</span>'); 
    } else {
        $('.navbar-header').html('<span class="navbar-brand"><a href="/">Artpacks.org</a>\\</span>');
    }

}
