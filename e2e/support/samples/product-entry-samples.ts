export interface ProductEntrySample {
    article: {
        name: string,
        barcode: string,
        __photo: any,
        __barcodeImageName: string,
        __existsOnRemote: string | boolean,
    };
    description: string;
    amount: number;
    expirationDate: Date;
    __scannedAt?: Date;
}

export class ProductEntrySamples {
    static validProductEntries: ProductEntrySample[] = [
        {
          article: {
              name: 'Supergood crisp yoghurt',
              barcode: '0704679371330',
              __photo: null,
              __barcodeImageName: 'barcode0',
              __existsOnRemote: 'testing',
          },
          description: 'delicous',
          amount: 3,
          expirationDate: new Date(2016, 7, 1),
        },
        {
          article: {
              name: 'Pumpkin',
              barcode: null,
              __photo: null,
              __barcodeImageName: null,
              __existsOnRemote: false,
          },
          description: 'big and orange',
          amount: 2,
          expirationDate: new Date(2016, 12, 4),
        },
        {
          article: {
              name: 'Garlic',
              barcode: '0704479271230',
              __photo: 'garlic',
              __barcodeImageName: null,
              __existsOnRemote: false,
          },
          description: 'small and white',
          amount: 1,
          expirationDate: new Date(2016, 12, 2),
        },
        {
          article: {
              name: 'Superfat Butter',
              barcode: '4017170008725',
              __photo: null,
              __barcodeImageName: 'barcode1',
              __existsOnRemote: 'testing',
          },
          description: 'awesome fat',
          amount: 2,
          expirationDate: new Date(2017, 7, 1),
        },
        {
          article: {
              name: 'Hard as Iron Muesli',
              barcode: '7610848570554',
              __photo: null,
              __barcodeImageName: 'barcode2',
              __existsOnRemote: 'testing',
          },
          description: 'it will crunch',
          amount: 4,
          expirationDate: new Date(2016, 1, 31),
        },
      ];
}
