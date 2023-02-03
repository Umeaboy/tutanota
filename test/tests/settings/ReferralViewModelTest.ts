import o from "ospec"
import { getDayShifted } from "@tutao/tutanota-utils"
import { DateProvider } from "../../../src/api/common/DateProvider.js"
import { CustomerInfo } from "../../../src/api/entities/sys/TypeRefs.js"
import { NewsModel } from "../../../src/misc/news/NewsModel.js"
import { object, when } from "testdouble"
import { showReferralNews } from "../../../src/settings/ReferralViewModel.js"

o.spec("ReferralViewModel", function () {
	let dateProvider: DateProvider
	let customerInfo: CustomerInfo
	let newsModel: NewsModel

	o.beforeEach(function () {
		dateProvider = object()
		customerInfo = object()
		newsModel = object()
	})

	o("showReferralNews returns null if account is not old enough", async function () {
		customerInfo.creationTime = new Date(0)
		when(dateProvider.now()).thenReturn(getDayShifted(new Date(0), 6).getTime())
		o(await showReferralNews(dateProvider, customerInfo, newsModel)).equals(null)
	})

	o("showReferralNews returns non-null if account is old enough", async function () {
		customerInfo.creationTime = new Date(0)
		when(dateProvider.now()).thenReturn(getDayShifted(new Date(0), 7).getTime())
		o(await showReferralNews(dateProvider, customerInfo, newsModel)).notEquals(null)
	})
})
