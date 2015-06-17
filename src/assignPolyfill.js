// Oject.assign polyfill from MDN https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/assign
if (!Object.assign) {
	Object.defineProperty(Object, 'assign', {
		enumerable: false,
		configurable: true,
		writable: true,
		value: function(target) {
			if ( target === undefined || target === null ) {
				throw new TypeError('Cannot convert first argument to object');
			}

			var to = Object(target);
			for ( var i = 1; i < arguments.length; i++ ) {
				var nextSource = arguments[i];
				if ( nextSource === undefined || nextSource === null ) {
					continue;
				}
				nextSource = Object(nextSource);

				var keysArray = Object.keys(Object(nextSource)),
					len = keysArray.length,
					nextIndex;

				for ( nextIndex = 0; nextIndex < len; nextIndex++) {
					var nextKey = keysArray[nextIndex];
					var desc = Object.getOwnPropertyDescriptor(
						nextSource, nextKey
					);

					if (desc !== undefined && desc.enumerable) {
						to[nextKey] = nextSource[nextKey];
					}
				}
			}
			return to;
		}
	});
}

module.exports = Object.assign;
