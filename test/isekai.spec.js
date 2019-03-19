import { expect } from "chai";
import Isekai from "../src/isekai";

describe(`[ISEKAI*ENGINE]`, () => {
    it(`should have EQUIP and SET functions`, () => {
        expect([
            typeof Isekai.EQUIP,
            typeof Isekai.SET
        ]).to.have.members([ `function`, `function` ]);
    });

    it(`should SET`, () => {
        Isekai.SET({
            FOO: {
                bar: 1
            }
        });

        expect(Isekai.FOO).to.deep.equal({
            bar: 1
        });

        Isekai.SET({
            FOO: {
                bar2: 2
            }
        });

        expect(Isekai.FOO).to.deep.equal({
            bar: 1,
            bar2: 2
        });

        Isekai.SET({
            FOO: {
                bar2: undefined
            }
        });

        expect(Isekai.FOO).to.deep.equal({
            bar: 1,
            bar2: undefined
        });
    });

    it(`should EQUIP`, () => {
        let called = 0;

        Isekai.EQUIP({
            foo: ({
                FOO: {
                    bar
                }
            }) => {
                called += 1;
                expect(called).to.equal(1);
                expect(bar).to.equal(1);
            },
            bar: () => {
                called += 1;
                expect(called).to.equal(2);
            }
        });

        expect(called).to.equal(2);
    });
});
