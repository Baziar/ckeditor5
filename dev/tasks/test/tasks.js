/* jshint node: true, esnext: true */

'use strict';

const gulp = require( 'gulp' );
const istanbul = require( 'gulp-istanbul' );
const gutil = require( 'gulp-util' );
const mocha = require( 'gulp-mocha' );
const chai = require( 'chai' );
const filterBy = require( 'gulp-filter-by' );
const filter = require( 'gulp-filter' );
const sinon = require( 'sinon' );
const devTools = require( '../dev/utils/tools' );
const semver = require( 'semver' );
const minimist = require( 'minimist' );
const buildUtils = require( '../build/utils' );

/**
 * Defines Node.js testing task.
 *
 * To run tests under node:
 *
 *		gulp node-test
 *
 * To run build before testing:
 *
 *		gulp node-test --build
 *
 * To run testing with code coverage:
 *
 * 		gulp node-test --coverage
 */
module.exports = () => {
	const ignoreRegexp = /\/\* ?bender-tags:.*\bbrowser-only\b.*\*\//;
	const options = minimist( process.argv.slice( 2 ), {
		boolean: [
			'coverage',
			'build'
		],

		default: {
			coverage: false,
			build: false
		}
	} );

	// Inject globals before running tests.
	global.should = chai.should;
	global.expect = chai.expect;
	global.assert = chai.assert;
	global.sinon = sinon;
	global.bender = { model: {}, view: {} };

	const tasks = {
		/**
		 * Prepares files for coverage report.
		 *
		 * @returns {Stream}
		 */
		prepareCoverage() {
			return gulp.src( 'build/cjs/ckeditor5/**/*.js' )
				.pipe( istanbul() )
				.pipe( istanbul.hookRequire() );
		},

		/**
		 * Runs tests in Node.js environment.
		 *
		 * @returns {Stream}
		 */
		testInNode() {
			const minVersion = '6.1.0';
			const src = [
				'build/cjs/tests/**/*.js',
				'!**/_utils/**/*.js',
				'!build/cjs/tests/{ui,ui-*}/**/*.js',
				'!build/cjs/tests/theme-*/**/*.js'
			];

			if ( semver.lt( process.version, minVersion ) ) {
				throw new gutil.PluginError( {
					plugin: 'test-node',
					message: `Wrong Node.js version. Please use Node.js in version v${ minVersion } or higher.`
				} );
			}

			// Include global test tools.
			global.bender.model = require( '../../../build/cjs/tests/engine/_utils/model.js' );
			global.bender.view = require( '../../../build/cjs/tests/engine/_utils/view.js' );

			return gulp.src( src )
				.pipe( tasks.skipManual() )
				.pipe( tasks.skipIgnored() )
				.pipe( mocha( { reporter: 'progress' } ) )
				.pipe( options.coverage ? istanbul.writeReports() : buildUtils.noop() );
		},

		/**
		 * Removes manual test files from source stream. It checks if the markdown file with the same name exists.
		 *
		 * @returns {Stream}
		 */
		skipManual() {
			return filter( ( file ) => {
				return !devTools.isFile( file.path.slice( 0, -3 ) + '.md' );
			} );
		},

		/**
		 * Skips test files that are marked to be ignored when testing outside browser.
		 * To ignore file, add `browser-only` to bender-tags comment in test file.
		 *
		 * @returns {Stream}
		 */
		skipIgnored() {
			return filterBy( file => !file.contents.toString().match( ignoreRegexp ) );
		}
	};

	gulp.task( 'test-node:coverage', [ 'build:js:cjs' ], tasks.prepareCoverage );

	if ( options.coverage ) {
		gulp.task( 'test-node', [ 'build:js:cjs', 'test-node:coverage' ], tasks.testInNode );
	} else {
		gulp.task( 'test-node', options.build ? [ 'build:js:cjs' ] : [], tasks.testInNode );
	}

	return tasks;
};
