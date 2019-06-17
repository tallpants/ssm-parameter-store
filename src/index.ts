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

class SsmParameterStore<TParameters extends Record<string, string>> {
  private ssm = new AWS.SSM();
  private loaded = false;

  private parameterNamesToKeys: Record<keyof TParameters, string>;
  private parameterKeysToValues: Record<string, string> = {};

  constructor(parameterNamesToKeys: TParameters) {
    this.parameterNamesToKeys = parameterNamesToKeys;
    Object.values(parameterNamesToKeys).forEach(key => {
      this.parameterKeysToValues[key] = '';
    });
  }

  private async fetchOne(parameterKey: string) {
    const ssmResponse = await this.ssm.getParameter({ Name: parameterKey, WithDecryption: true }).promise();
    return ssmResponse.Parameter ? ssmResponse.Parameter.Value : undefined;
  }

  private async fetchTen(parameterKeys: string[]) {
    const ssmResponse = await this.ssm.getParameters({ Names: parameterKeys, WithDecryption: true }).promise();

    const responseParameterMap: Record<string, string | undefined> = {};

    if (ssmResponse.Parameters) {
      ssmResponse.Parameters.forEach(parameter => {
        responseParameterMap[parameter.Name!] = parameter.Value;
      });
    }

    return parameterKeys.map(key => responseParameterMap[key]);
  }

  private async loadAll() {
    const parameterNamesToKeysArray = Object.entries(this.parameterNamesToKeys).map(([name, key]) => ({ name, key }));

    const parameterNamesToKeysArrayChunks = chunk(parameterNamesToKeysArray, 10);

    await Promise.all(
      parameterNamesToKeysArrayChunks.map(async chunk => {
        const values = await this.fetchTen(chunk.map(nameToKeyPair => nameToKeyPair.key));
        chunk.forEach((nameToKeyPair, idx) => {
          this.parameterKeysToValues[nameToKeyPair.key] = values[idx]!;
        });
      })
    );

    this.loaded = true;
  }

  async preload({ ignoreCache }: { ignoreCache: boolean } = { ignoreCache: false }) {
    if (!this.loaded || ignoreCache) {
      await this.loadAll();
    }
  }

  async getAll({ ignoreCache }: { ignoreCache: boolean } = { ignoreCache: false }) {
    if (!this.loaded || ignoreCache) {
      await this.loadAll();
    }

    const response: Record<keyof TParameters, string | undefined> = { ...this.parameterNamesToKeys };
    Object.keys(response).forEach(name => {
      response[name as keyof TParameters] = this.parameterKeysToValues[this.parameterNamesToKeys[name]];
    });

    return response;
  }

  async get(name: keyof TParameters, { ignoreCache }: { ignoreCache: boolean } = { ignoreCache: false }) {
    if (!this.parameterNamesToKeys.hasOwnProperty(name)) {
      throw new Error(`Parameter ${name} doesn't exist.`);
    }

    try {
      if (!this.loaded || ignoreCache) {
        const key = this.parameterNamesToKeys[name];
        const value = await this.fetchOne(this.parameterNamesToKeys[name]);
        this.parameterKeysToValues[key] = value!;
        return value;
      }

      return this.parameterKeysToValues[this.parameterNamesToKeys[name]];
    } catch (err) {
      return undefined;
    }
  }
}

export = SsmParameterStore;
