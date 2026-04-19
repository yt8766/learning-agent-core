import { Injectable } from '@nestjs/common';

@Injectable()
export class CommonService {
  getHealth() {
    return {
      ok: true
    };
  }
}
