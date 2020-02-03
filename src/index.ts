import AWS from 'aws-sdk';

function chunk<T>(array: T[], chunkSize: number): Array<T[]> {
  const arrays: Array<T[]> = [];
  let currentChunk = 0;

  array.forEach(value => {
    if (!arrays[currentChunk]) {
      arrays[currentChunk] = [value];
    } else {
      arrays[currentChunk].push(value);
    }

    if (arrays[currentChunk].length === chunkSize) {
      currentChunk += 1;
    }
  });

  return arrays;
}

interface Options {
  ignoreCache: boolean;
}

class SSMParameterStore<TParameters extends Record<string, string>> {
  private ssm = new AWS.SSM();

  private parameterNamesToKeys = {} as TParameters;
  private parameterKeysToValues: Record<string, string> = {};
  private keyLoaded: Record<string, boolean> = {};

  private async fetchOne(key: string) {
    try {
      const ssmResponse = await this.ssm.getParameter({ Name: key, WithDecryption: true }).promise();
      return ssmResponse.Parameter!.Value!;
    } catch (err) {
      if (err.code === 'ParameterNotFound') {
        return '';
      }
      throw err;
    }
  }

  private async fetchTen(keys: string[]) {
    const ssmResponse = await this.ssm.getParameters({ Names: keys, WithDecryption: true }).promise();
    const responseKeysToValues: Record<string, string> = {};

    for (const parameter of ssmResponse.Parameters!) {
      responseKeysToValues[parameter.Name!] = parameter.Value!;
    }

    return keys.map(key => responseKeysToValues[key] || '');
  }

  private async loadAll() {
    const parameterKeysArray = Object.values(this.parameterNamesToKeys);
    const parameterKeysArrayChunks = chunk(parameterKeysArray, 10);

    await Promise.all(
      parameterKeysArrayChunks.map(async chunk => {
        const chunkValues = await this.fetchTen(chunk);
        chunkValues.forEach((value, idx) => {
          const key = chunk[idx];
          this.parameterKeysToValues[key] = value;
          this.keyLoaded[key] = true;
        });
      })
    );
  }

  constructor(parameterNamesToKeys: TParameters) {
    this.parameterNamesToKeys = parameterNamesToKeys;
    for (const key of Object.values(parameterNamesToKeys)) {
      this.parameterKeysToValues[key] = '';
      this.keyLoaded[key] = false;
    }
  }

  async preload(options: Options = { ignoreCache: false }) {
    if (options.ignoreCache || Object.values(this.keyLoaded).some(keyLoadedState => keyLoadedState === false)) {
      return this.loadAll();
    }
  }

  async get(name: keyof TParameters, options: Options = { ignoreCache: false }) {
    const key = this.parameterNamesToKeys[name];

    if (!key) {
      throw new Error(`Unknown parameter ${name}. Not in new SSMParameterStore({ }) declaration`);
    }

    if (options.ignoreCache || !this.keyLoaded[key]) {
      const value = await this.fetchOne(key);
      this.parameterKeysToValues[key] = value;
      this.keyLoaded[key] = true;
    }

    return this.parameterKeysToValues[key];
  }

  async getAll(options: Options = { ignoreCache: false }) {
    await this.preload(options);

    const response = {} as Record<keyof TParameters, string>;
    Object.entries(this.parameterNamesToKeys).forEach(([name, key]) => {
      response[name as keyof TParameters] = this.parameterKeysToValues[key];
    });

    return response;
  }
}

export = SSMParameterStore;
