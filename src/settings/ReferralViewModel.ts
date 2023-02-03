import { lang } from "../misc/LanguageViewModel.js"
import { isApp } from "../api/common/Env.js"
import { locator } from "../api/main/MainLocator.js"
import { copyToClipboard } from "../misc/ClipboardUtils.js"
import { showSnackBar } from "../gui/base/SnackBar.js"
import { logins } from "../api/main/LoginController.js"
import { getDayShifted } from "@tutao/tutanota-utils"
import { CustomerInfo } from "../api/entities/sys/TypeRefs.js"
import { NewsModel } from "../misc/news/NewsModel.js"
import { ReferralLinkNews } from "../misc/news/items/ReferralLinkNews.js"
import { DateProvider } from "../api/common/DateProvider.js"

const REFERRAL_NEWS_DISPLAY_THRESHOLD_DAYS = 7

/**
 * Share the referral link.
 *
 * This is client-dependent. On mobile, it uses the native share dialog, where on the desktop and web client, it copies to the clipboard.
 */
export function shareReferralLink(): Promise<void> {
	const shareMessage = lang.get("referralLinkShare_msg", {
		"{referralLink}": getReferralLink(),
	})
	// open native share dialog on mobile
	if (isApp()) {
		return locator.systemFacade.shareText(shareMessage, lang.get("referralSettings_label")).then()
	} else {
		// (mobile) browser or desktop client
		// copy to the clip board
		return copyToClipboard(shareMessage).then(() =>
			showSnackBar({
				message: () => "Copied some stuff to your clipboard",
				button: {
					label: "close_alt",
					click: () => {},
				},
			}),
		)
	}
}

/**
 * Get the referral link for the logged in user
 */
export function getReferralLink(): string {
	// TODO determine if using user ID is a good idea (i.e. privacy reasons such as multiple aliases)
	const userId = logins.getUserController().userId
	return `https://mail.tutanota.com/signup?referral=${userId}`
}

/**
 * Show the referral news for the customer if it is old enough.
 * @param dateProvider
 * @param customerInfo
 * @param newsModel
 * @return referral news item or null if the customer is not old enough
 */
export async function showReferralNews(dateProvider: DateProvider, customerInfo: CustomerInfo, newsModel: NewsModel): Promise<ReferralLinkNews | null> {
	// check if customer is more than one week old
	if (customerInfo.creationTime <= getDayShifted(new Date(dateProvider.now()), -REFERRAL_NEWS_DISPLAY_THRESHOLD_DAYS)) {
		const { ReferralLinkNews } = await import("../misc/news/items/ReferralLinkNews.js")
		return new ReferralLinkNews(newsModel)
	} else {
		console.log("New customer. Skipping showing referral link news.")
		return null
	}
}
