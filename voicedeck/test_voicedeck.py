import voicedeck as V


def test_align_follows_the_take_with_pauses_and_adlibs():
    says = ["one two three four five", "six seven eight nine", "ten eleven twelve"]
    take = "uh one two three four five um so six seven eight nine okay ten eleven twelve".split()
    words = [(w, i * 1.0, i * 1.0 + 0.5) for i, w in enumerate(take)]
    st = V.align(says, words)
    assert st[0] == 0.0
    assert abs(st[1] - (8 - 0.15)) < 1e-6        # "six" is word 8
    assert abs(st[2] - (13 - 0.15)) < 1e-6       # "ten" is word 13


def test_align_survives_a_skipped_slide():
    says = ["alpha beta gamma", "delta epsilon", "zeta eta theta"]
    take = "alpha beta gamma zeta eta theta".split()
    st = V.align(says, [(w, i * 1.0, i + 0.5) for i, w in enumerate(take)])
    assert st[0] < st[1] < st[2]
