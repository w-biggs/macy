const gulp = require('gulp');
const browserSync = require('browser-sync');
const nodemon = require('gulp-nodemon');
const sourcemaps = require('gulp-sourcemaps');
const sass = require('gulp-sass')(require('sass'));

gulp.task('styles', () => {
  return gulp.src('scss/**/*.scss')
    .pipe(sourcemaps.init())
    .pipe(sass().on('error', sass.logError))
    .pipe(sourcemaps.write())
    .pipe(gulp.dest('./public/css/'))
    .pipe(browserSync.stream());
});

gulp.task('nodemon', (cb) => {
	let started = false;
	
	return nodemon({
		script: 'server.js'
	}).on('start', function () {
		// to avoid nodemon being started multiple times
		// thanks @matthisk
		if (!started) {
			cb();
			started = true; 
		} 
	});
});

gulp.task('browser-sync', gulp.series('nodemon', () => {
	browserSync.init(null, {
		proxy: "http://localhost:3030",
    reloadDelay: 10,
    ui: false,
    notify: false,
    port: 3031
	});

  gulp.watch("scss/**/*.scss", gulp.series('styles'));
  gulp.watch(["views/**/*.hbs", "public/**/*.js"]).on('change', browserSync.reload);
}));

gulp.task('default', gulp.series('styles', 'browser-sync'));