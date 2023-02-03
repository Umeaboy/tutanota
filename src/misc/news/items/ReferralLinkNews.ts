import { NewsListItem } from "../NewsListItem.js"
import m, { Children } from "mithril"
import { NewsId } from "../../../api/entities/tutanota/TypeRefs.js"
import { Button, ButtonAttrs, ButtonType } from "../../../gui/base/Button.js"
import { NewsModel } from "../NewsModel.js"
import { isApp } from "../../../api/common/Env.js"
import { shareReferralLink } from "../../../settings/ReferralViewModel.js"

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
		const label = isApp() ? "share_action" : "copy_action"

		const buttonAttrs: Array<ButtonAttrs> = [
			{
				label: "close_alt",
				click: () => this.newsModel.acknowledgeNews(newsId.newsItemId).then(m.redraw),
				type: ButtonType.Secondary,
			},
			{
				label: label,
				click: shareReferralLink,
				type: ButtonType.Primary,
			},
		]

		return m(".full-width", [
			m(".h4", "Refer a friend to Tutanota"),
			m(".pb", "You can refer a friend to Tutanota today."),
			m(
				".flex-end.flex-no-grow-no-shrink-auto.flex-wrap",
				buttonAttrs.map((a) => m(Button, a)),
			),
		])
	}
}
