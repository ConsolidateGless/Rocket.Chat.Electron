import jetpack from 'fs-jetpack';
import path from 'path';
import { put, select, takeEvery } from 'redux-saga/effects';
import spellchecker from 'spellchecker';
import {
	USER_DATA_LOADED,
	INSTALL_SPELLCHECKING_DICTIONARIES,
	TOGGLE_SPELLCHECKING_DICTIONARY,
	UPDATE_SPELLCHECKING_CORRECTIONS,
	spellCheckingConfigurationLoaded,
	spellCheckingDictionaryInstalled,
	spellCheckingDictionaryInstallFailed,
	spellCheckingDictionariesEnabled,
	spellCheckingCorrectionsUpdated,
} from '../actions';
import { getDirectory } from './userData/fileSystem';


const doLoadConfig = function* () {
	const embeddedDictionaries = spellchecker.getAvailableDictionaries();
	const supportsMultipleDictionaries = embeddedDictionaries.length > 0 && process.platform !== 'win32';

	const directory = getDirectory('app', 'dictionaries');
	const dictionaryInstallationDirectory = directory.path();

	const installedDictionaries = (yield directory.findAsync({ matching: '*.{aff,dic}' }))
		.map((fileName) => path.basename(fileName, path.extname(fileName)));

	const availableDictionaries = Array.from(new Set([...embeddedDictionaries, ...installedDictionaries])).sort();

	yield put(spellCheckingConfigurationLoaded({
		supportsMultipleDictionaries,
		dictionaryInstallationDirectory,
		availableDictionaries,
	}));
};

const doInstallSpellCheckingDictionaries = function* ({ payload: filePaths }) {
	const { spellchecking: { dictionaryInstallationDirectory } } = yield select();

	for (const filePath of filePaths) {
		const dictionary = path.basename(filePath, path.extname(filePath));
		const basename = path.basename(filePath);
		const newPath = path.join(dictionaryInstallationDirectory, basename);
		try {
			yield jetpack.copyAsync(filePath, newPath);
			yield put(spellCheckingDictionaryInstalled(dictionary));
		} catch (error) {
			yield put(spellCheckingDictionaryInstallFailed(dictionary, error));
		}
	}
};

const filterDictionaries = (availableDictionaries, supportsMultipleDictionaries, dictionaries) => (
	Array.from(
		new Set(
			dictionaries
				.flatMap((dictionary) => {
					const matches = /^(\w+?)[-_](\w+)$/.exec(dictionary);
					return matches ?
						[`${ matches[1] }_${ matches[2] }`, `${ matches[1] }-${ matches[2] }`, matches[1]] :
						[dictionary];
				})
				.filter((dictionary) => availableDictionaries.includes(dictionary))
		)
	)
		.slice(...supportsMultipleDictionaries ? [] : [0, 1])
);

const doToggleSpellCheckingDictionary = function* ({ payload: { dictionary, enabled } }) {
	const {
		preferences: {
			enabledDictionaries,
		},
		spellchecking: {
			availableDictionaries,
			supportsMultipleDictionaries,
		},
	} = yield select();

	const dictionaries = filterDictionaries(
		availableDictionaries,
		supportsMultipleDictionaries,
		enabled ?
			[dictionary, ...enabledDictionaries] :
			enabledDictionaries.filter((_dictionary) => _dictionary !== dictionary)
	);
	yield put(spellCheckingDictionariesEnabled(dictionaries));
};

const doUpdateSpellCheckingCorrections = function* ({ payload: word }) {
	const {
		preferences: {
			enabledDictionaries,
		},
		spellchecking: {
			dictionaryInstallationDirectory,
		},
	} = yield select();

	word = word.trim();

	if (word === '' || enabledDictionaries.length === 0) {
		yield put(spellCheckingCorrectionsUpdated(null));
		return;
	}

	yield put(spellCheckingCorrectionsUpdated(Array.from(new Set(
		enabledDictionaries.flatMap((dictionary) => {
			spellchecker.setDictionary(dictionary, dictionaryInstallationDirectory);
			return spellchecker.getCorrectionsForMisspelling(word);
		})
	))));
};

export const useSpellChecking = async ({ runSaga }) => {
	runSaga(function* watchSpellCheckingActions() {
		yield *doLoadConfig();
		yield takeEvery(USER_DATA_LOADED, doLoadConfig);
		yield takeEvery(INSTALL_SPELLCHECKING_DICTIONARIES, doInstallSpellCheckingDictionaries);
		yield takeEvery(TOGGLE_SPELLCHECKING_DICTIONARY, doToggleSpellCheckingDictionary);
		yield takeEvery(UPDATE_SPELLCHECKING_CORRECTIONS, doUpdateSpellCheckingCorrections);
	});
};
