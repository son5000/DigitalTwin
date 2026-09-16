import assert from "node:assert/strict";
import { test } from "node:test";

import { createSequentialCopyName } from "../src/features/digitalTwin/editor/utils/objectCopyName.js";

test("복제 이름은 복사본 문구를 제거하고 같은 이름의 다음 번호를 사용한다", () => {
  const siblings = [
    { name: "단일 팬 실외기 01" },
    { name: "단일 팬 실외기 01 복사본 복사본" },
    { name: "단일 팬 실외기 02" },
  ];
  assert.equal(createSequentialCopyName("단일 팬 실외기 01", siblings), "단일 팬 실외기 03");
  assert.equal(createSequentialCopyName("단일 팬 실외기 02", [...siblings, { name: "단일 팬 실외기 03" }]), "단일 팬 실외기 04");
});
