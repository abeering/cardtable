var gulp = require('gulp');
var nodemon = require('gulp-nodemon');
var concat = require('gulp-concat');
var uglify = require('gulp-uglify');
var react = require('gulp-react');
var htmlreplace = require('gulp-html-replace');

var paths = {
  // source paths for content types
  HTML: ['src/*.html'],
  JS: ['src/js/*.js', 'src/js/**/*.js'],
  CSS: ['src/css/*.css', 'src/css/**/*.css'],
  NODEMON_IGNORE: ['src/*', 'dist/*', 'build/*'],
  // asset paths for content types
  HTML_DEST: 'dist',
  JS_DEST: 'dist/js',
  CSS_DEST: 'dist/css',
  // production build output
  MINIFIED_JS_OUT: 'js/build.min.js',
  BUILD_CSS_DEST: 'dist/build/css',
  BUILD_DEST: 'dist/build'
};

// development watchers

// node server files
gulp.task('nodemon', function(){
  nodemon({
    script: 'server.js',
    ignore: paths.NODEMON_IGNORE,
    env: { 'NODE_ENV': 'development' }
  });
});

// other assets
// watch for changes to js and copy
gulp.task('js_copy', function(){
  gulp.src(paths.JS)
    .pipe(react())
    .pipe(gulp.dest(paths.JS_DEST));
});
gulp.task('watch_js', function(){
  gulp.watch(paths.JS, ['js_copy']);
});
// watch for changes to html and copy
gulp.task('html_copy', function(){
  gulp.src(paths.HTML)
    .pipe(gulp.dest(paths.HTML_DEST));
});
gulp.task('watch_html', function(){
  gulp.watch(paths.HTML, ['html_copy']);
});
// watch for changes to css and copy
gulp.task('css_copy', function(){
  gulp.src(paths.CSS)
    .pipe(gulp.dest(paths.CSS_DEST));
});
gulp.task('watch_css', function(){
  gulp.watch(paths.CSS, ['css_copy']);
});

// production shenanigans
gulp.task('build_js', function(){
  gulp.src(paths.JS)
    .pipe(react())
    .pipe(concat(paths.MINIFIED_JS_OUT))
    .pipe(uglify(paths.MINIFIED_JS_OUT))
    .pipe(gulp.dest(paths.BUILD_DEST));
});
gulp.task('build_html', function(){
  gulp.src(paths.HTML)
    .pipe(htmlreplace({
      'js': 'build/' + paths.MINIFIED_JS_OUT
    }))
    .pipe(gulp.dest(paths.BUILD_DEST));
});
gulp.task('build_css', function(){
  gulp.src(paths.CSS)
    .pipe(gulp.dest(paths.BUILD_CSS_DEST));
});

gulp.task('default',
  [
    'html_copy',
    'js_copy',
    'css_copy',
    'watch_js',
    'watch_html',
    'watch_css',
    'nodemon'
  ]
);
gulp.task('production', ['build_html', 'build_js', 'build_css']);
