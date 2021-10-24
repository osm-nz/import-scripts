import { nztmToWgs } from "../nztmToWgs";

// the first three test cases are from https://linz.govt.nz/system/files_force/media/file-attachments/nztm.zip

describe("nztmToWgs", () => {
  it.each`
    x             | y             | lat                    | lng
    ${1576041.15} | ${6188574.24} | ${-34.44406191348699}  | ${172.73919397641492}
    ${1576542.01} | ${5515331.05} | ${-40.5124032038241}   | ${172.72310597842494}
    ${1307103.22} | ${4826464.86} | ${-46.65000401626757}  | ${169.17208906930503}
    ${1825556}    | ${5946643}    | ${-36.598645304758335} | ${175.52159408134605}
  `("can convert ($x, $y) to ($lat, $lng)", ({ x, y, lat, lng }) => {
    expect(nztmToWgs(x, y)).toStrictEqual([lng, lat]);
  });
});
