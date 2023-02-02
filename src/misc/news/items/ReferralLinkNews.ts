import { NewsListItem } from "../NewsListItem.js"
import m, { Children } from "mithril"
import { NewsId } from "../../../api/entities/tutanota/TypeRefs.js"
import { Button, ButtonAttrs, ButtonType } from "../../../gui/base/Button.js"
import { NewsModel } from "../NewsModel.js"

/**
 * News item that informs users about option to refer friends.
 */
export class ReferralLinkNews implements NewsListItem {
	constructor(private readonly newsModel: NewsModel) {}

	isShown(): boolean {
		// TODO store on the user if they already when they were last shown this item
		return true
	}

	render(newsId: NewsId): Children {
		const buttonAttrs: Array<ButtonAttrs> = [
			{
				label: "ok_action",
				click: () => () => {
					this.newsModel.acknowledgeNews(newsId.newsItemId).then(m.redraw)
				},
				type: ButtonType.Primary,
			},
		]

		return m(".full-width", [
			m("p", "Do you want to refer a friend?"),
			m(
				".flex-end.flex-no-grow-no-shrink-auto.flex-wrap",
				buttonAttrs.map((a) => m(Button, a)),
			),
		])
	}
}
